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
const findMatchedHeader = (headers, aliases) => {
    const normalizedAliases = aliases.map(normalizeText);
    return headers.find((header) => normalizedAliases.includes(normalizeText(header)));
};
const buildHeaderMap = (headers) => ({
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
            const rawRows = xlsx_1.default.utils.sheet_to_json(worksheet, {
                defval: '',
                raw: false
            });
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
                busLookup.set(normalizeText(bus.id), bus.id);
                busLookup.set(normalizeText(bus.busCode), bus.id);
                if (bus.registrationNumber) {
                    busLookup.set(normalizeText(bus.registrationNumber), bus.id);
                }
            });
            const unmatchedBusValues = new Set();
            const previewRows = rawRows
                .map((rawRow, index) => {
                const name = readMappedValue(rawRow, headerMap, 'name');
                const telRaw = readMappedValue(rawRow, headerMap, 'tel');
                const note = readMappedValue(rawRow, headerMap, 'note');
                const busRaw = readMappedValue(rawRow, headerMap, 'bus');
                if (!name && !telRaw && !note && !busRaw) {
                    return null;
                }
                const normalizedBus = normalizeText(busRaw);
                const matchedBusId = normalizedBus ? busLookup.get(normalizedBus) ?? null : null;
                if (busRaw && !matchedBusId) {
                    unmatchedBusValues.add(busRaw);
                }
                return {
                    localId: `excel_${Date.now()}_${index}`,
                    name,
                    tel: telRaw.replace(/\D/g, ''),
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
            // 🔥 check passenger thuộc tenant
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
