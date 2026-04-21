"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passengerController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
