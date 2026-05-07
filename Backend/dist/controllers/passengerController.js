"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passengerController = void 0;
const client_1 = require("@prisma/client");
const xlsx_1 = __importDefault(require("xlsx"));
const prisma = new client_1.PrismaClient();
const HEADER_ALIASES = {
    name: ['name', 'hoten', 'ten', 'fullname', 'full name', 'ho va ten', 'hova ten', 'Họ và tên'],
    tel: ['tel', 'phone', 'phonenumber', 'sodienthoai', 'sdt', 'mobile', 'dien thoai', 'Số điện thoại'],
    note: ['note', 'ghichu', 'ghi chu', 'remark', 'remarks', 'description', 'mo ta', 'Ghi chú'],
    bus: ['bus', 'buscode', 'maxe', 'ma xe', 'xe', 'bien so', 'bienso', 'registration', 'registrationnumber', 'Mã xe']
};
const normalizeText = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const normalizeBusLookupKeys = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
        return [];
    }
    const keys = new Set([normalized]);
    if (/^\d+$/.test(normalized)) {
        const strippedLeadingZeros = normalized.replace(/^0+(?=\d)/, '');
        keys.add(strippedLeadingZeros);
    }
    return Array.from(keys);
};
const toText = (value) => String(value ?? '').trim();
// Excel hay mat so 0 dau khi cot dien thoai o dang Number, nen bo sung quy tac phuc hoi an toan.
const normalizeImportedPhone = (value) => {
    const digitsOnly = value.replace(/\D/g, '').trim();
    if (digitsOnly.length === 9) {
        return `0${digitsOnly}`;
    }
    return digitsOnly;
};
const isAliasMatched = (normalizedHeader, normalizedAlias) => normalizedHeader === normalizedAlias ||
    normalizedHeader.includes(normalizedAlias) ||
    normalizedAlias.includes(normalizedHeader);
const findMatchedHeader = (headers, aliases) => {
    const normalizedAliases = aliases.map(normalizeText);
    return headers.find((header) => {
        const normalizedHeader = normalizeText(header);
        return normalizedAliases.some((alias) => isAliasMatched(normalizedHeader, alias));
    });
};
const scoreHeaderRow = (cells) => {
    // Cham diem de tim dong co kha nang la header cao nhat trong cac dong dau.
    let score = 0;
    const seen = new Set();
    cells.forEach((cell) => {
        const normalizedCell = normalizeText(cell);
        if (!normalizedCell) {
            return;
        }
        Object.keys(HEADER_ALIASES).forEach((field) => {
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
const parseRowsFromWorksheet = (worksheet) => {
    // Doc sheet theo ma tran de xu ly duoc file co dong tieu de khong nam o dong dau tien.
    const matrix = xlsx_1.default.utils.sheet_to_json(worksheet, {
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
        const row = {};
        headers.forEach((header, index) => {
            row[header] = toText(rowCells?.[index]);
        });
        return row;
    })
        .filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''));
};
const buildHeaderMap = (headers) => ({
    // Map ten cot trong file nguoi dung vao cot noi bo cua he thong.
    name: findMatchedHeader(headers, HEADER_ALIASES.name),
    tel: findMatchedHeader(headers, HEADER_ALIASES.tel),
    note: findMatchedHeader(headers, HEADER_ALIASES.note),
    bus: findMatchedHeader(headers, HEADER_ALIASES.bus)
});
const readMappedValue = (row, fieldMap, field) => {
    const headerKey = fieldMap[field];
    if (!headerKey) {
        return '';
    }
    return String(row[headerKey] ?? '').trim();
};
exports.passengerController = {
    getAll: async (req, res) => {
        try {
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
            res.json(passengers);
        }
        catch (error) {
            console.error('❌ getAll passengers error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    create: async (req, res) => {
        try {
            const tripId = Number(req.params.tripId);
            if (!tripId) {
                return res.status(400).json({ message: 'Missing tripId' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const { name, note, busId } = req.body;
            const tel = String(req.body?.tel ?? '').trim();
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
            res.status(201).json(passenger);
        }
        catch (error) {
            console.error(' create passenger error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    importPreview: async (req, res) => {
        try {
            const tripId = Number(req.params.tripId);
            if (!tripId) {
                return res.status(400).json({ message: 'Missing tripId' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const file = req.file;
            if (!file) {
                return res.status(400).json({ message: 'Vui long chon file Excel' });
            }
            const workbook = xlsx_1.default.read(file.buffer, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
                return res.status(400).json({ message: 'File Excel khong co sheet hop le' });
            }
            const worksheet = workbook.Sheets[firstSheetName];
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
            const busLookup = new Map();
            buses.forEach((bus) => {
                normalizeBusLookupKeys(bus.id).forEach((key) => busLookup.set(key, bus.id));
                normalizeBusLookupKeys(bus.busCode).forEach((key) => busLookup.set(key, bus.id));
                if (bus.registrationNumber) {
                    normalizeBusLookupKeys(bus.registrationNumber).forEach((key) => busLookup.set(key, bus.id));
                }
            });
            const unmatchedBusValues = new Set();
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
                    .find((value) => value !== undefined) ?? null;
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
                .filter((item) => item !== null);
            return res.json({
                rows: previewRows,
                totalRows: rawRows.length,
                importedRows: previewRows.length,
                unmatchedBusValues: Array.from(unmatchedBusValues),
                matchedColumns: headerMap
            });
        }
        catch (error) {
            console.error('❌ import passenger preview error:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    },
    update: async (req, res) => {
        try {
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
                }
            });
            if (!existing) {
                return res.status(404).json({ message: 'Passenger not found' });
            }
            let nextBusId;
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
                    ...(tel !== undefined ? { tel: String(tel).trim() } : {}),
                    ...(note !== undefined ? { note } : {}),
                    ...(nextBusId ? { busId: nextBusId } : {})
                }
            });
            res.json(updated);
        }
        catch (error) {
            console.error('❌ update passenger error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    delete: async (req, res) => {
        try {
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
                }
            });
            if (!existing) {
                return res.status(404).json({ message: 'Passenger not found' });
            }
            await prisma.passenger.delete({
                where: { id: Number(id) }
            });
            res.json({ message: 'Deleted successfully' });
        }
        catch (error) {
            console.error(' delete passenger error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};
