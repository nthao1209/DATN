import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import XLSX from 'xlsx';
import { prisma } from '../config/db';
import { publishDashboardRefresh } from '../services/mqtt';

type ImportField = 'name' | 'tel' | 'note' | 'bus';
type SheetCell = string | number | boolean | Date | null | undefined;

const HEADER_ALIASES: Record<ImportField, string[]> = {
  // Cho phép file Excel dùng nhiều tên cột khác nhau nhưng vẫn map về field chuẩn.
  name: ['name', 'hoten', 'ten', 'fullname', 'full name', 'ho va ten', 'hova ten','Họ và tên'],
  tel: ['tel', 'phone', 'phonenumber', 'sodienthoai', 'sdt', 'mobile', 'dien thoai', 'Số điện thoại'],
  note: ['note', 'ghichu', 'ghi chu', 'remark', 'remarks', 'description', 'mo ta', 'Ghi chú'],
  bus: ['bus', 'buscode', 'maxe', 'ma xe', 'xe', 'bien so', 'bienso', 'registration', 'registrationnumber','Mã xe']
};

const normalizeText = (value: unknown): string =>
  // Bỏ dấu, bỏ ký tự đặc biệt để so khớp header/bus code mềm hơn.
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizeBusLookupKeys = (value: unknown): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  const keys = new Set<string>([normalized]);

  if (/^\d+$/.test(normalized)) {
    const strippedLeadingZeros = normalized.replace(/^0+(?=\d)/, '');
    keys.add(strippedLeadingZeros);
  }

  return Array.from(keys);
};

const toText = (value: SheetCell): string => String(value ?? '').trim();

const normalizeOptionalPhoneText = (value: unknown): string => {
  const text = String(value ?? '').trim();
  return text.toLowerCase() === 'null' ? '' : text;
};

const normalizeImportedPhone = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '').trim();
  if (digitsOnly.length === 9) {
    return `0${digitsOnly}`;
  }
  return digitsOnly;
};

const isAliasMatched = (normalizedHeader: string, normalizedAlias: string): boolean =>
  normalizedHeader === normalizedAlias ||
  normalizedHeader.includes(normalizedAlias) ||
  normalizedAlias.includes(normalizedHeader);

const findMatchedHeader = (headers: string[], aliases: string[]): string | undefined => {
  const normalizedAliases = aliases.map(normalizeText);
  return headers.find((header) => {
    const normalizedHeader = normalizeText(header);
    return normalizedAliases.some((alias) => isAliasMatched(normalizedHeader, alias));
  });
};

const scoreHeaderRow = (cells: SheetCell[]): number => {
  let score = 0;
  const seen = new Set<ImportField>();

  cells.forEach((cell) => {
    const normalizedCell = normalizeText(cell);
    if (!normalizedCell) {
      return;
    }

    (Object.keys(HEADER_ALIASES) as ImportField[]).forEach((field) => {
      if (seen.has(field)) {
        return;
      }

      const matched = HEADER_ALIASES[field]
        .map(normalizeText)
        .some((alias) => isAliasMatched(normalizedCell, alias));

      if (matched) {
        seen.add(field);
        score += 1;
      }
    });
  });

  return score;
};

const parseRowsFromWorksheet = (worksheet: XLSX.WorkSheet): Record<string, unknown>[] => {
  // Tự dò dòng header trong 10 dòng đầu để hỗ trợ file Excel có tiêu đề/phần mô tả phía trên.
  const matrix = XLSX.utils.sheet_to_json<SheetCell[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false
  });

  if (!matrix.length) {
    return [];
  }

  const scanLimit = Math.min(10, matrix.length);
  let bestHeaderRowIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < scanLimit; i += 1) {
    const score = scoreHeaderRow(matrix[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestHeaderRowIndex = i;
    }
  }

  const headerCells = matrix[bestHeaderRowIndex] ?? [];
  const headers = headerCells.map((cell, index) => {
    const text = toText(cell);
    return text || `col_${index + 1}`;
  });

  return matrix
    .slice(bestHeaderRowIndex + 1)
    .map((rowCells) => {
      const row: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        row[header] = toText(rowCells?.[index]);
      });
      return row;
    })
    .filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''));
};

const buildHeaderMap = (headers: string[]): Record<ImportField, string | undefined> => ({
  // Map header thật trong file Excel về các field hệ thống cần: name/tel/note/bus.
  name: findMatchedHeader(headers, HEADER_ALIASES.name),
  tel: findMatchedHeader(headers, HEADER_ALIASES.tel),
  note: findMatchedHeader(headers, HEADER_ALIASES.note),
  bus: findMatchedHeader(headers, HEADER_ALIASES.bus)
});

const readMappedValue = (
  row: Record<string, unknown>,
  fieldMap: Record<ImportField, string | undefined>,
  field: ImportField
): string => {
  const headerKey = fieldMap[field];
  if (!headerKey) {
    return '';
  }
  return String(row[headerKey] ?? '').trim();
};

export const passengerController = {

  getAll: async (req: AuthRequest, res: Response) => {
    try {
      // Lấy hành khách theo chuyến, có thể lọc theo xe/keyword/scope attendance.
      const tripId = Number(req.params.tripId);
      const busIdQuery = req.query.busId;
      const scope = String(req.query.scope || '');
      const keyword = String(req.query.keyword || '').trim();
      const busId = busIdQuery ? Number(busIdQuery) : undefined;

      if (!tripId) {
        return res.status(400).json({ message: 'Missing tripId' });
      }

      if (busIdQuery !== undefined && !busId) {
        return res.status(400).json({ message: 'Invalid busId query' });
      }

      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const managerFilter = scope === 'attendance'
        ? {}
        : req.roleId === 3 && req.user?.id
        ? { managerId: req.user.id }
        : {};

      const passengers = await prisma.passenger.findMany({
        where: {
          ...(keyword
            ? {
                name: {
                  contains: keyword,
                  mode: 'insensitive'
                }
              }
            : {}),
          bus: {
            ...(busId ? { id: busId } : {}),
            ...managerFilter,
            trip: {
              id: tripId,
              tenantId: req.tenantId
            }
          }
        },
        include: {
          bus: {
            select: {
              id: true,
              busCode: true,
              registrationNumber: true,
              trip: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          }
        },
        orderBy: [
          { busId: 'asc' },
          { id: 'asc' }
        ]
      });

      res.json(passengers.map((passenger) => ({
        ...passenger,
        tel: normalizeOptionalPhoneText(passenger.tel)
      })));

    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },

  create: async (req: AuthRequest, res: Response) => {
    try {
      // Tạo hành khách mới và đảm bảo xe được chọn thuộc đúng chuyến/tenant.
      const tripId = Number(req.params.tripId);

      if (!tripId) {
        return res.status(400).json({ message: 'Missing tripId' });
      }

      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { name, note, busId } = req.body;
      const tel = normalizeOptionalPhoneText(req.body?.tel);
      const busIdNumber = Number(busId);

      if (!name) {
        return res.status(400).json({ message: 'Missing name' });
      }

      if (!busIdNumber) {
        return res.status(400).json({ message: 'Missing busId' });
      }

      const bus = await prisma.bus.findFirst({
        where: {
          id: busIdNumber,
          tripId,
          trip: {
            tenantId: req.tenantId
          }
        }
      });

      if (!bus) {
        return res.status(404).json({ message: 'Bus not found' });
      }

      const passenger = await prisma.passenger.create({
        data: {
          name: String(name).trim(),
          tel,
          note,
          busId: busIdNumber
        }
      });

      publishDashboardRefresh(req.tenantId, {
        type: 'dashboard.refresh',
        entity: 'passenger',
        action: 'create',
        tripId,
        passengerId: passenger.id,
        updatedAt: new Date().toISOString(),
      });

      res.status(201).json(passenger);

    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },

  getImportSheets: async (req: AuthRequest, res: Response) => {
    try {
      // Đọc tên các sheet để frontend cho người dùng chọn sheet cần import.
      const tripId = Number(req.params.tripId);

      if (!tripId) {
        return res.status(400).json({ message: 'Missing tripId' });
      }

      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: 'Vui lòng chọn file Excel' });
      }
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      return res.json({ sheets: workbook.SheetNames });

    } catch (error) {
      return res.status(500).json({ message: 'Server error' });
    }
  },
  importPreview: async (req: AuthRequest, res: Response) => {
    try {
      // Chỉ preview dữ liệu import: map cột, chuẩn hóa SĐT, dò xe, báo lỗi dòng chưa hợp lệ.
      const tripId = Number(req.params.tripId);

      if (!tripId) {
        return res.status(400).json({ message: 'Missing tripId' });
      }

      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: 'Vui lòng chọn file Excel' });
      }

      const workbook = XLSX.read(file.buffer, { type: 'buffer' });

      const requestedSheet = String(
        req.body.sheetName || ''
      ).trim();

      const actualSheetName =
        workbook.SheetNames.find(
          (sheet) =>
            sheet.trim() === requestedSheet
        );

      if (!actualSheetName) {
        return res.status(400).json({
          message: `Sheet "${requestedSheet}" not found`
        });
      }

      const worksheet =
        workbook.Sheets[actualSheetName];
    
      const rawRows = parseRowsFromWorksheet(worksheet);

      if (!rawRows.length) {
        return res.json({
          rows: [],
          totalRows: 0,
          importedRows: 0,
          unmatchedBusValues: [],
          matchedColumns: {}
        });
      }

      const headers = Object.keys(rawRows[0] ?? {});
      const headerMap = buildHeaderMap(headers);

      const buses = await prisma.bus.findMany({
        where: {
          tripId,
          trip: {
            tenantId: req.tenantId
          }
        },
        select: {
          id: true,
          busCode: true,
          registrationNumber: true
        }
      });

      const busLookup = new Map<string, number>();
      // Cho phép dò xe bằng id, mã xe hoặc biển số trong file Excel.
      buses.forEach((bus) => {
        normalizeBusLookupKeys(bus.id).forEach((key) => busLookup.set(key, bus.id));
        normalizeBusLookupKeys(bus.busCode).forEach((key) => busLookup.set(key, bus.id));
        if (bus.registrationNumber) {
          normalizeBusLookupKeys(bus.registrationNumber).forEach((key) => busLookup.set(key, bus.id));
        }
      });

      const unmatchedBusValues = new Set<string>();
      const previewRows = rawRows
        .map((rawRow, index) => {
          const name = readMappedValue(rawRow, headerMap, 'name');
          const telRaw = normalizeImportedPhone(readMappedValue(rawRow, headerMap, 'tel'));
          const note = readMappedValue(rawRow, headerMap, 'note');
          const busRaw = readMappedValue(rawRow, headerMap, 'bus');

          if (!name && !telRaw && !note && !busRaw) {
            return null;
          }

          const normalizedBusKeys = normalizeBusLookupKeys(busRaw);
          const matchedBusId = normalizedBusKeys
            .map((key) => busLookup.get(key))
            .find((value): value is number => value !== undefined) ?? null;

          if (busRaw && !matchedBusId) {
            unmatchedBusValues.add(busRaw);
          }

          return {
            localId: `excel_${Date.now()}_${index}`,
            name,
            tel: telRaw,
            note,
            tripId,
            busId: matchedBusId,
            busCode: busRaw
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return res.json({
        rows: previewRows,
        totalRows: rawRows.length,
        importedRows: previewRows.length,
        unmatchedBusValues: Array.from(unmatchedBusValues),
        matchedColumns: headerMap
      });
    } catch (error) {
      return res.status(500).json({ message: 'Server error' });
    }
  },

  update: async (req: AuthRequest, res: Response) => {
    try {
      // Cập nhật hồ sơ khách; nếu đổi xe thì xác thực xe mới vẫn thuộc tenant hiện tại.
      const { id } = req.params;

      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { name, note, busId } = req.body;
      const tel = req.body?.tel;

      const existing = await prisma.passenger.findFirst({
        where: {
          id: Number(id),
          bus: {
            trip: {
              tenantId: req.tenantId
            }
          }
        },
        select: {
          id: true,
          name: true,
          busId: true,
          tel: true,
          note: true,
          bus: {
            select: {
              tripId: true
            }
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ message: 'Passenger not found' });
      }

      let nextBusId: number | undefined;

      if (busId !== undefined && busId !== null) {
        const busIdNumber = Number(busId);
        if (!busIdNumber) {
          return res.status(400).json({ message: 'Invalid busId' });
        }

        const bus = await prisma.bus.findFirst({
          where: {
            id: busIdNumber,
            trip: {
              tenantId: req.tenantId
            }
          }
        });

        if (!bus) {
          return res.status(404).json({ message: 'Bus not found' });
        }

        nextBusId = busIdNumber;
      }

      const updated = await prisma.passenger.update({
        where: { id: Number(id) },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(tel !== undefined ? { tel: normalizeOptionalPhoneText(tel) } : {}),
          ...(note !== undefined ? { note } : {}),
          ...(nextBusId ? { busId: nextBusId } : {})
        }
      });

      publishDashboardRefresh(req.tenantId, {
        type: 'dashboard.refresh',
        entity: 'passenger',
        action: 'update',
        tripId: existing.bus.tripId,
        passengerId: updated.id,
        updatedAt: new Date().toISOString(),
      });

      res.json(updated);

    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },

  delete: async (req: AuthRequest, res: Response) => {
    try {
      // Xóa hành khách theo tenant và phát sự kiện refresh cho dashboard/trang liên quan.
      const { id } = req.params;

      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const existing = await prisma.passenger.findFirst({
        where: {
          id: Number(id),
          bus: {
            trip: {
              tenantId: req.tenantId
            }
          }
        },
        select: {
          id: true,
          name: true,
          busId: true,
          tel: true,
          note: true,
          bus: {
            select: {
              tripId: true
            }
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ message: 'Passenger not found' });
      }

      await prisma.passenger.delete({
        where: { id: Number(id) }
      });

      publishDashboardRefresh(req.tenantId, {
        type: 'dashboard.refresh',
        entity: 'passenger',
        action: 'delete',
        tripId: existing.bus.tripId,
        passengerId: Number(id),
        updatedAt: new Date().toISOString(),
      });

      res.json({ message: 'Deleted successfully' });

    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
};
