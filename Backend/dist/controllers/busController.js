"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.busController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.busController = {
    getAll: async (req, res) => {
        const tripId = Number(req.params.tripId);
        if (!tripId) {
            return res.status(400).json({ message: 'Missing tripId' });
        }
        if (!req.tenantId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const buses = await prisma.bus.findMany({
            where: {
                tripId,
                trip: {
                    tenantId: req.tenantId
                }
            },
            include: {
                manager: true,
                trip: true
            },
            orderBy: {
                id: 'desc'
            }
        });
        res.json(buses);
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
            const { registrationNumber, busCode, driverName, driverTel, tourGuideName, tourGuideTel, description, managerId, } = req.body;
            if (!registrationNumber || !busCode || !driverName || !driverTel || !tourGuideName || !tourGuideTel) {
                return res.status(400).json({ message: 'Missing required fields' });
            }
            const data = {
                registrationNumber,
                busCode,
                driverName,
                driverTel,
                tourGuideName,
                tourGuideTel,
                description,
                tripId,
            };
            if (managerId) {
                data.managerId = Number(managerId);
            }
            const bus = await prisma.bus.create({
                data,
                include: {
                    manager: true,
                }
            });
            res.status(201).json(bus);
        }
        catch (error) {
            console.error('create bus error:', {
                message: error.message,
                code: error.code,
                meta: error.meta
            });
            res.status(500).json({ message: 'Server error', detail: error.message });
        }
    },
    update: async (req, res) => {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: 'Missing  id' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const { registrationNumber, busCode, driverName, driverTel, tourGuideName, tourGuideTel, description, managerId } = req.body;
            const existing = await prisma.bus.findFirst({
                where: {
                    id: Number(id),
                    trip: {
                        tenantId: req.tenantId
                    }
                }
            });
            if (!existing) {
                return res.status(404).json({ message: 'Bus not found' });
            }
            const updated = await prisma.bus.update({
                where: { id: Number(id) },
                data: {
                    registrationNumber,
                    busCode,
                    driverName,
                    driverTel,
                    tourGuideName,
                    tourGuideTel,
                    description,
                    ...(managerId !== undefined && managerId !== null ? { managerId: Number(managerId) } : {})
                }
            });
            res.json(updated);
        }
        catch (error) {
            console.error('update bus error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    delete: async (req, res) => {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: 'Missing bus id' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const existing = await prisma.bus.findFirst({
                where: {
                    id: Number(id),
                    trip: {
                        tenantId: req.tenantId
                    }
                }
            });
            if (!existing) {
                return res.status(404).json({ message: 'Bus not found' });
            }
            await prisma.bus.delete({
                where: { id: Number(id) }
            });
            res.json({ message: "Deleted" });
        }
        catch (error) {
            console.error('delete bus error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    getBusManagers: async (req, res) => {
        try {
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const users = await prisma.user.findMany({
                where: {
                    userTenants: {
                        some: {
                            tenantId: req.tenantId,
                            roleId: 3,
                        }
                    }
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    description: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
            res.json(users);
        }
        catch (error) {
            console.error('get bus managers error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};
