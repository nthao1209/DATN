"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripController = void 0;
const mqtt_1 = require("../services/mqtt");
const db_1 = require("../config/db");
var Status;
(function (Status) {
    Status["DOING"] = "DOING";
    Status["DONE"] = "DONE";
})(Status || (Status = {}));
const getTripCompletionCounts = async (tripId, tenantId) => {
    const [roundCount, completedRoundCount] = await Promise.all([
        db_1.prisma.round.count({
            where: {
                tripId,
                trip: {
                    tenantId,
                },
            },
        }),
        db_1.prisma.round.count({
            where: {
                tripId,
                trip: {
                    tenantId,
                },
                status: Status.DONE,
            },
        }),
    ]);
    return { roundCount, completedRoundCount };
};
exports.tripController = {
    getAll: async (req, res) => {
        const tenantId = req.tenantId;
        if (!tenantId) {
            return res.status(400).json({ message: 'Missing tenantId' });
        }
        const trips = await db_1.prisma.trip.findMany({
            where: { tenantId },
            include: {
                _count: { select: { buses: true, rounds: true } },
                rounds: {
                    select: { status: true },
                },
            }
        });
        res.json(trips.map((trip) => ({
            ...trip,
            completedRoundCount: trip.rounds.filter((round) => round.status === Status.DONE).length,
        })));
    },
    create: async (req, res) => {
        const tenantId = req.tenantId;
        if (!tenantId) {
            return res.status(400).json({ message: 'Missing tenantId' });
        }
        const { name, status } = req.body;
        const trip = await db_1.prisma.trip.create({
            data: { name, status, tenantId }
        });
        (0, mqtt_1.publishDashboardRefresh)(tenantId, {
            type: 'dashboard.refresh',
            entity: 'trip',
            action: 'create',
            tripId: trip.id,
            updatedAt: new Date().toISOString(),
        });
        res.status(201).json(trip);
    },
    update: async (req, res) => {
        const { id } = req.params;
        const { name, status } = req.body;
        if (!req.tenantId) {
            return res.status(401).json({ message: 'Missing tenantId' });
        }
        const existing = await db_1.prisma.trip.findFirst({
            where: {
                id: Number(id),
                tenantId: req.tenantId,
            },
        });
        if (!existing) {
            return res.status(404).json({ message: 'Trip not found' });
        }
        if (status !== undefined && String(status).trim().toUpperCase() === Status.DONE) {
            const { roundCount, completedRoundCount } = await getTripCompletionCounts(existing.id, req.tenantId);
            if (completedRoundCount !== roundCount) {
                return res.status(400).json({
                    message: 'Chuyến chỉ được hoàn thành khi tất cả chặng đều đã hoàn thành',
                });
            }
        }
        const updated = await db_1.prisma.trip.update({
            where: { id: Number(id) },
            data: { name, status }
        });
        (0, mqtt_1.publishDashboardRefresh)(req.tenantId, {
            type: 'dashboard.refresh',
            entity: 'trip',
            action: 'update',
            tripId: updated.id,
            updatedAt: new Date().toISOString(),
        });
        res.json(updated);
    },
    delete: async (req, res) => {
        try {
            const tripId = Number(req.params.id);
            const tenantId = req.tenantId;
            if (!tripId) {
                return res.status(400).json({ message: 'Missing trip id' });
            }
            if (!tenantId) {
                return res.status(401).json({ message: 'Missing tenantId' });
            }
            const existing = await db_1.prisma.trip.findFirst({
                where: {
                    id: tripId,
                    tenantId,
                },
                select: {
                    id: true,
                    buses: {
                        select: { id: true },
                    },
                    rounds: {
                        select: { id: true },
                    },
                },
            });
            if (!existing) {
                return res.status(404).json({ message: 'Trip not found' });
            }
            const busIds = existing.buses.map((bus) => bus.id);
            const roundIds = existing.rounds.map((round) => round.id);
            await db_1.prisma.$transaction(async (tx) => {
                const unlockRequests = await tx.unlockRequest.findMany({
                    where: {
                        OR: [
                            { busId: { in: busIds } },
                            { roundId: { in: roundIds } },
                        ],
                    },
                    select: { id: true },
                });
                const notificationFilters = [
                    { payload: { path: ['tripId'], equals: tripId } },
                    ...busIds.map((busId) => ({ payload: { path: ['busId'], equals: busId } })),
                    ...roundIds.map((roundId) => ({ payload: { path: ['roundId'], equals: roundId } })),
                    ...unlockRequests.map((request) => ({ payload: { path: ['requestId'], equals: request.id } })),
                ];
                await tx.notification.deleteMany({
                    where: {
                        OR: notificationFilters,
                    },
                });
                await tx.attendanceEvent.deleteMany({
                    where: {
                        OR: [
                            {
                                bus: {
                                    tripId,
                                },
                            },
                            {
                                transaction: {
                                    round: {
                                        tripId,
                                    },
                                },
                            },
                        ],
                    },
                });
                await tx.busRoundStatus.deleteMany({
                    where: {
                        OR: [
                            { busId: { in: busIds } },
                            { roundId: { in: roundIds } },
                        ],
                    },
                });
                await tx.unlockRequest.deleteMany({
                    where: {
                        OR: [
                            { busId: { in: busIds } },
                            { roundId: { in: roundIds } },
                        ],
                    },
                });
                await tx.trip.delete({
                    where: { id: tripId },
                });
            });
            (0, mqtt_1.publishDashboardRefresh)(tenantId, {
                type: 'dashboard.refresh',
                entity: 'trip',
                action: 'delete',
                tripId,
                updatedAt: new Date().toISOString(),
            });
            res.json({ message: "Deleted" });
        }
        catch (error) {
            res.status(500).json({
                message: error?.message || 'Cannot delete trip',
            });
        }
    }
};
