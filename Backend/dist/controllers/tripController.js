"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripController = void 0;
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
        res.json(updated);
    },
    delete: async (req, res) => {
        const { id } = req.params;
        await db_1.prisma.trip.delete({ where: { id: Number(id) } });
        res.json({ message: "Deleted" });
    }
};
