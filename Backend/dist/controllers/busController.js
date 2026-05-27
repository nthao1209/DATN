"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.busController = void 0;
const db_1 = require("../config/db");
const mqtt_1 = __importDefault(require("mqtt"));
const mqtt_2 = require("../services/mqtt");
const mqttClient = mqtt_1.default.connect(process.env.MQTT_URL || 'wss://mqtt.toolhub.app:8084', {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clean: true,
    clientId: `backend_bus_${Date.now()}_${Math.random().toString(16).slice(2)}`,
});
const publishLockUpdate = (tripId, busId, roundId, checkInLocked, checkOutLocked) => {
    const topic = 'attendance/ui/locks';
    const payload = {
        type: 'bus.round.lock.updated',
        tripId,
        busId,
        roundId,
        checkInLocked,
        checkOutLocked,
        updatedAt: new Date().toISOString(),
    };
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
    console.log(`[Bus] Published lock update to ${topic}:`, payload);
};
const resolveActorId = async (req) => {
    if (req.user?.id)
        return req.user.id;
    if (req.firebaseUser?.uid) {
        const user = await db_1.prisma.user.findUnique({
            where: { firebaseUid: req.firebaseUser.uid },
            select: { id: true },
        });
        return user?.id ?? null;
    }
    return null;
};
exports.busController = {
    getAll: async (req, res) => {
        const tripId = Number(req.params.tripId);
        if (!tripId) {
            return res.status(400).json({ message: 'Missing tripId' });
        }
        if (!req.tenantId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const managerFilter = req.roleId === 3 && req.user?.id
            ? { managerId: req.user.id }
            : {};
        const buses = await db_1.prisma.bus.findMany({
            where: {
                tripId,
                ...managerFilter,
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
            if (!registrationNumber || !busCode || !managerId) {
                return res.status(400).json({ message: 'Missing required fields' });
            }
            const data = {
                registrationNumber,
                busCode,
                description,
                tripId,
                managerId: Number(managerId),
            };
            if (driverName !== undefined)
                data.driverName = driverName;
            if (driverTel !== undefined)
                data.driverTel = driverTel;
            if (tourGuideName !== undefined)
                data.tourGuideName = tourGuideName;
            if (tourGuideTel !== undefined)
                data.tourGuideTel = tourGuideTel;
            const bus = await db_1.prisma.bus.create({
                data,
                include: {
                    manager: true,
                }
            });
            (0, mqtt_2.publishDashboardRefresh)(req.tenantId, {
                type: 'dashboard.refresh',
                entity: 'bus',
                action: 'create',
                tripId,
                busId: bus.id,
                updatedAt: new Date().toISOString(),
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
            if (!registrationNumber || !busCode || !managerId) {
                return res.status(400).json({ message: 'Missing required fields' });
            }
            const existing = await db_1.prisma.bus.findFirst({
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
            const updated = await db_1.prisma.bus.update({
                where: { id: Number(id) },
                data: {
                    registrationNumber,
                    busCode,
                    driverName,
                    driverTel,
                    tourGuideName,
                    tourGuideTel,
                    description,
                    managerId: Number(managerId)
                }
            });
            (0, mqtt_2.publishDashboardRefresh)(req.tenantId, {
                type: 'dashboard.refresh',
                entity: 'bus',
                action: 'update',
                tripId: existing.tripId,
                busId: updated.id,
                updatedAt: new Date().toISOString(),
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
            const existing = await db_1.prisma.bus.findFirst({
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
            await db_1.prisma.bus.delete({
                where: { id: Number(id) }
            });
            (0, mqtt_2.publishDashboardRefresh)(req.tenantId, {
                type: 'dashboard.refresh',
                entity: 'bus',
                action: 'delete',
                tripId: existing.tripId,
                busId: Number(id),
                updatedAt: new Date().toISOString(),
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
            const users = await db_1.prisma.user.findMany({
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
    },
    getRoundStatuses: async (req, res) => {
        try {
            const tripId = Number(req.query.tripId);
            if (!tripId) {
                return res.status(400).json({ message: 'Missing tripId' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const statuses = await db_1.prisma.busRoundStatus.findMany({
                where: {
                    bus: {
                        tripId,
                        trip: {
                            tenantId: req.tenantId,
                        },
                    },
                },
            });
            res.json(statuses);
        }
        catch (error) {
            console.error('getRoundStatuses error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    confirmCompletion: async (req, res) => {
        try {
            const busId = Number(req.params.busId);
            const roundId = Number(req.params.roundId);
            if (!busId || !roundId) {
                return res.status(400).json({ message: 'Missing busId or roundId' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const actorId = await resolveActorId(req);
            if (!actorId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const bus = await db_1.prisma.bus.findFirst({
                where: {
                    id: busId,
                    trip: {
                        tenantId: req.tenantId,
                    },
                },
                select: { id: true, tripId: true },
            });
            if (!bus) {
                return res.status(404).json({ message: 'Bus not found' });
            }
            const round = await db_1.prisma.round.findFirst({
                where: {
                    id: roundId,
                    trip: {
                        tenantId: req.tenantId,
                    },
                },
                select: { id: true, tripId: true },
            });
            if (!round) {
                return res.status(404).json({ message: 'Round not found' });
            }
            const status = await db_1.prisma.busRoundStatus.findUnique({
                where: { busId_roundId: { busId, roundId } },
            });
            if (!status?.checkInLocked || !status.checkOutLocked) {
                return res.status(400).json({
                    message: 'Both check-in and check-out must be locked before completing the round',
                });
            }
            const completed = await db_1.prisma.busRoundStatus.upsert({
                where: { busId_roundId: { busId, roundId } },
                create: {
                    busId,
                    roundId,
                    checkInLocked: true,
                    checkOutLocked: true,
                    driverConfirmedBy: actorId,
                },
                update: {
                    driverConfirmedBy: status.driverConfirmedBy ?? actorId,
                },
            });
            res.json(completed);
        }
        catch (error) {
            console.error('confirmCompletion error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    confirmChecks: async (req, res) => {
        try {
            const busId = Number(req.params.busId);
            const roundId = Number(req.params.roundId);
            if (!busId || !roundId) {
                return res.status(400).json({ message: 'Missing busId or roundId' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const { checkInLocked, checkOutLocked } = req.body;
            const nextCheckInLocked = checkInLocked === undefined ? undefined : Boolean(checkInLocked);
            const nextCheckOutLocked = checkOutLocked === undefined ? undefined : Boolean(checkOutLocked);
            const now = new Date();
            const existingBus = await db_1.prisma.bus.findFirst({ where: { id: busId, trip: { tenantId: req.tenantId } } });
            if (!existingBus) {
                return res.status(404).json({ message: 'Bus not found' });
            }
            const existingStatus = await db_1.prisma.busRoundStatus.findUnique({
                where: { busId_roundId: { busId, roundId } },
            });
            if (nextCheckInLocked === true && existingStatus?.checkInLocked) {
                return res.status(409).json({ message: 'Lượt đi của xe này đã được khóa' });
            }
            if (nextCheckOutLocked === true && existingStatus?.checkOutLocked) {
                return res.status(409).json({ message: 'Lượt về của xe này đã được khóa' });
            }
            const up = await db_1.prisma.busRoundStatus.upsert({
                where: { busId_roundId: { busId, roundId } },
                create: {
                    busId,
                    roundId,
                    checkInLocked: nextCheckInLocked ?? false,
                    checkInAt: nextCheckInLocked ? now : null,
                    checkOutLocked: nextCheckOutLocked ?? false,
                    checkOutAt: nextCheckOutLocked ? now : null,
                },
                update: {
                    ...(nextCheckInLocked !== undefined
                        ? {
                            checkInLocked: nextCheckInLocked,
                            checkInAt: nextCheckInLocked ? now : null,
                        }
                        : {}),
                    ...(nextCheckOutLocked !== undefined
                        ? {
                            checkOutLocked: nextCheckOutLocked,
                            checkOutAt: nextCheckOutLocked ? now : null,
                        }
                        : {}),
                },
            });
            const [busInfo, roundInfo] = await Promise.all([
                db_1.prisma.bus.findFirst({
                    where: { id: busId, trip: { tenantId: req.tenantId } },
                    include: { trip: true },
                }),
                db_1.prisma.round.findFirst({ where: { id: roundId } }),
            ]);
            if (busInfo?.trip?.id) {
                publishLockUpdate(busInfo.trip.id, busId, roundId, up.checkInLocked, up.checkOutLocked);
            }
            res.json(up);
        }
        catch (error) {
            console.error('confirmChecks error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};
