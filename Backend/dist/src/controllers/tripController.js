"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.tripController = {
    getAll: async (req, res) => {
        const tenantId = req.tenantId;
        if (!tenantId) {
            return res.status(400).json({ message: 'Missing tenantId' });
        }
        const trips = await prisma.trip.findMany({
            where: { tenantId },
            include: { _count: { select: { buses: true, rounds: true } } }
        });
        res.json(trips);
    },
    create: async (req, res) => {
        const tenantId = req.tenantId;
        if (!tenantId) {
            return res.status(400).json({ message: 'Missing tenantId' });
        }
        const { name, status } = req.body;
        const trip = await prisma.trip.create({
            data: { name, status, tenantId }
        });
        res.status(201).json(trip);
    },
    update: async (req, res) => {
        const { id } = req.params;
        const { name, status } = req.body;
        const updated = await prisma.trip.update({
            where: { id: Number(id) },
            data: { name, status }
        });
        res.json(updated);
    },
    delete: async (req, res) => {
        const { id } = req.params;
        await prisma.trip.delete({ where: { id: Number(id) } });
        res.json({ message: "Deleted" });
    }
};
