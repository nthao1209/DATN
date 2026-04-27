"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const ensureTenant = (req, res) => {
    if (!req.tenantId) {
        res.status(401).json({ message: 'Unauthorized' });
        return null;
    }
    return req.tenantId;
};
const canAccessTransactions = (req) => req.roleId === 2 || req.roleId === 3 || req.roleId === 1;
exports.transactionController = {
    getAll: async (req, res) => {
        try {
            const tenantId = ensureTenant(req, res);
            if (!tenantId)
                return;
            if (!canAccessTransactions(req)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            const managerCondition = req.roleId === 3 && req.user?.id
                ? {
                    OR: [
                        {
                            bus: {
                                managerId: req.user.id,
                                trip: {
                                    tenantId
                                }
                            }
                        },
                        {
                            passenger: {
                                bus: {
                                    managerId: req.user.id,
                                    trip: {
                                        tenantId
                                    }
                                }
                            }
                        }
                    ]
                }
                : {
                    bus: {
                        trip: {
                            tenantId
                        }
                    }
                };
            const transactions = await prisma.transaction.findMany({
                where: managerCondition,
                include: {
                    passenger: {
                        include: {
                            bus: {
                                select: {
                                    id: true,
                                    busCode: true,
                                    registrationNumber: true
                                }
                            }
                        }
                    },
                    round: true,
                    bus: {
                        select: {
                            id: true,
                            busCode: true,
                            registrationNumber: true
                        }
                    }
                },
                orderBy: [{ roundId: 'asc' }, { busId: 'asc' }, { passengerId: 'asc' }]
            });
            res.json(transactions);
        }
        catch (error) {
            console.error('get transactions error:', error);
            res.status(500).json({ message: 'Server error', detail: error?.message });
        }
    },
    create: async (req, res) => {
        try {
            const tenantId = ensureTenant(req, res);
            if (!tenantId)
                return;
            if (!canAccessTransactions(req)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            const busId = Number(req.body?.busId);
            const roundId = Number(req.body?.roundId);
            const passengerId = Number(req.body?.passengerId);
            if (!busId || !roundId || !passengerId) {
                return res.status(400).json({ message: 'busId, roundId, passengerId are required' });
            }
            const bus = await prisma.bus.findFirst({
                where: { id: busId, trip: { tenantId } }
            });
            if (!bus)
                return res.status(404).json({ message: 'Bus not found' });
            const round = await prisma.round.findFirst({
                where: { id: roundId, trip: { tenantId } }
            });
            if (!round)
                return res.status(404).json({ message: 'Round not found' });
            const passenger = await prisma.passenger.findFirst({
                where: {
                    id: passengerId,
                    bus: {
                        trip: { tenantId }
                    }
                }
            });
            if (!passenger)
                return res.status(404).json({ message: 'Passenger not found' });
            const existing = await prisma.transaction.findUnique({
                where: {
                    passengerId_roundId: {
                        passengerId,
                        roundId
                    }
                }
            });
            const incomingCheckIn = req.body?.checkIn !== undefined ? Boolean(req.body?.checkIn) : undefined;
            const incomingCheckOut = req.body?.checkOut !== undefined ? Boolean(req.body?.checkOut) : undefined;
            const incomingNote = req.body?.note ? String(req.body.note).trim() : null;
            const nextCheckIn = existing
                ? Boolean(existing.checkIn) || Boolean(incomingCheckIn)
                : Boolean(incomingCheckIn);
            const nextCheckOut = existing
                ? Boolean(existing.checkOut) || Boolean(incomingCheckOut)
                : Boolean(incomingCheckOut);
            const created = await prisma.transaction.upsert({
                where: {
                    passengerId_roundId: {
                        passengerId,
                        roundId
                    }
                },
                update: {
                    busId,
                    checkIn: nextCheckIn,
                    checkOut: nextCheckOut,
                    note: incomingNote
                },
                create: {
                    busId,
                    roundId,
                    passengerId,
                    checkIn: nextCheckIn,
                    checkOut: nextCheckOut,
                    note: incomingNote
                }
            });
            res.status(201).json(created);
        }
        catch (error) {
            console.error('create transaction error:', error);
            res.status(500).json({ message: 'Server error', detail: error?.message });
        }
    },
    update: async (req, res) => {
        try {
            const tenantId = ensureTenant(req, res);
            if (!tenantId)
                return;
            if (!canAccessTransactions(req)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            const id = Number(req.params.id);
            if (!id) {
                return res.status(400).json({ message: 'Invalid transaction id' });
            }
            const existing = await prisma.transaction.findFirst({
                where: {
                    id,
                    bus: {
                        trip: {
                            tenantId
                        }
                    }
                }
            });
            if (!existing) {
                return res.status(404).json({ message: 'Transaction not found' });
            }
            const expectedUpdatedAtRaw = req.body?.expectedUpdatedAt;
            if (expectedUpdatedAtRaw) {
                const expectedUpdatedAt = new Date(String(expectedUpdatedAtRaw));
                if (Number.isNaN(expectedUpdatedAt.getTime())) {
                    return res.status(400).json({ message: 'Invalid expectedUpdatedAt' });
                }
                if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
                    return res.status(409).json({
                        message: 'Dữ liệu đã được cập nhật bởi người khác. Vui lòng tải lại để đồng bộ.',
                        latest: existing
                    });
                }
            }
            const checkInInput = req.body?.checkIn;
            const checkOutInput = req.body?.checkOut;
            const nextCheckIn = checkInInput !== undefined
                ? Boolean(checkInInput)
                : existing.checkIn;
            const nextCheckOut = checkOutInput !== undefined
                ? Boolean(checkOutInput)
                : existing.checkOut;
            const updated = await prisma.transaction.update({
                where: { id },
                data: {
                    ...(checkInInput !== undefined ? { checkIn: nextCheckIn } : {}),
                    ...(checkOutInput !== undefined ? { checkOut: nextCheckOut } : {}),
                    ...(req.body?.note !== undefined ? { note: req.body.note ? String(req.body.note).trim() : null } : {})
                }
            });
            res.json(updated);
        }
        catch (error) {
            console.error('update transaction error:', error);
            res.status(500).json({ message: 'Server error', detail: error?.message });
        }
    },
    delete: async (req, res) => {
        try {
            const tenantId = ensureTenant(req, res);
            if (!tenantId)
                return;
            if (!canAccessTransactions(req)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            const id = Number(req.params.id);
            if (!id) {
                return res.status(400).json({ message: 'Invalid transaction id' });
            }
            const existing = await prisma.transaction.findFirst({
                where: {
                    id,
                    bus: {
                        trip: {
                            tenantId
                        }
                    }
                }
            });
            if (!existing) {
                return res.status(404).json({ message: 'Transaction not found' });
            }
            await prisma.transaction.delete({ where: { id } });
            res.json({ message: 'Deleted successfully' });
        }
        catch (error) {
            console.error('delete transaction error:', error);
            res.status(500).json({ message: 'Server error', detail: error?.message });
        }
    }
};
