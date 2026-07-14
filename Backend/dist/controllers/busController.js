"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.busController = void 0;
const db_1 = require("../config/db");
const mqtt_1 = require("../services/mqtt");
const publishLockUpdate = (tripId, busId, roundId, checkInLocked, checkOutLocked) => {
    // Khi khóa/mở khóa lượt, broadcast cho cả màn admin và màn transaction theo trip.
    const payload = {
        type: 'bus.round.lock.updated',
        tripId,
        busId,
        roundId,
        checkInLocked,
        checkOutLocked,
        updatedAt: new Date().toISOString(),
    };
    ['attendance/ui/locks', `attendance/trips/${tripId}/locks`].forEach((topic) => {
        (0, mqtt_1.publishJson)(topic, payload);
    });
};
const resolveActorId = async (req) => {
    // Một số request chỉ có Firebase uid, nên cần quy đổi về user id nội bộ trước khi ghi DB.
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
        // Role quản lý xe chỉ được thấy xe mình phụ trách; admin thấy toàn bộ xe trong chuyến.
        const tripId = Number(req.params.tripId);
        if (!tripId) {
            return res.status(400).json({ message: 'Thiếu thông tin chuyến xe (tripId)' });
        }
        if (!req.tenantId) {
            return res.status(401).json({ message: 'Không có quyền truy cập' });
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
                return res.status(400).json({ message: 'Thiếu thông tin chuyến xe (tripId)' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Không có quyền truy cập' });
            }
            const { registrationNumber, busCode, driverName, driverTel, tourGuideName, tourGuideTel, description, managerId, } = req.body;
            if (!busCode) {
                return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
            }
            const normalizedBusCode = String(busCode).trim().toUpperCase();
            const duplicateBus = await db_1.prisma.bus.findFirst({
                where: {
                    tripId,
                    busCode: normalizedBusCode,
                    trip: {
                        tenantId: req.tenantId,
                    },
                },
                select: { id: true },
            });
            if (duplicateBus) {
                return res.status(400).json({ message: 'Mã xe đã tồn tại trong chuyến này' });
            }
            const data = {
                registrationNumber: registrationNumber || null,
                busCode: normalizedBusCode,
                description: description || null,
                tripId,
            };
            if (managerId)
                data.managerId = Number(managerId);
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
            (0, mqtt_1.publishDashboardRefresh)(req.tenantId, {
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
            res.status(500).json({ message: 'Không thể lưu xe. Vui lòng thử lại.', detail: error.message });
        }
    },
    update: async (req, res) => {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: 'Thiếu ID' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Không có quyền truy cập' });
            }
            const { registrationNumber, busCode, driverName, driverTel, tourGuideName, tourGuideTel, description, managerId } = req.body;
            if (!busCode) {
                return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
            }
            const normalizedBusCode = String(busCode).trim().toUpperCase();
            const existing = await db_1.prisma.bus.findFirst({
                where: {
                    id: Number(id),
                    trip: {
                        tenantId: req.tenantId
                    }
                }
            });
            if (!existing) {
                return res.status(404).json({ message: 'Không tìm thấy xe' });
            }
            const duplicateBus = await db_1.prisma.bus.findFirst({
                where: {
                    tripId: existing.tripId,
                    busCode: normalizedBusCode,
                    id: {
                        not: Number(id),
                    },
                    trip: {
                        tenantId: req.tenantId,
                    },
                },
                select: { id: true },
            });
            if (duplicateBus) {
                return res.status(400).json({ message: 'Mã xe đã tồn tại trong chuyến này' });
            }
            const updated = await db_1.prisma.bus.update({
                where: { id: Number(id) },
                data: {
                    registrationNumber: registrationNumber || null,
                    busCode: normalizedBusCode,
                    driverName: driverName || null,
                    driverTel: driverTel || null,
                    tourGuideName: tourGuideName || null,
                    tourGuideTel: tourGuideTel || null,
                    description: description || null,
                    managerId: managerId ? Number(managerId) : null
                }
            });
            (0, mqtt_1.publishDashboardRefresh)(req.tenantId, {
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
            res.status(500).json({ message: 'Không thể lưu xe. Vui lòng thử lại.' });
        }
    },
    delete: async (req, res) => {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: 'Thiếu thông tin xe (busId)' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Không có quyền truy cập' });
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
                return res.status(404).json({ message: 'Không tìm thấy xe' });
            }
            await db_1.prisma.bus.delete({
                where: { id: Number(id) }
            });
            (0, mqtt_1.publishDashboardRefresh)(req.tenantId, {
                type: 'dashboard.refresh',
                entity: 'bus',
                action: 'delete',
                tripId: existing.tripId,
                busId: Number(id),
                updatedAt: new Date().toISOString(),
            });
            res.json({ message: "Đã xóa" });
        }
        catch (error) {
            res.status(500).json({ message: 'Lỗi hệ thống' });
        }
    },
    getBusManagers: async (req, res) => {
        try {
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Không có quyền truy cập' });
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
            res.status(500).json({ message: 'Lỗi hệ thống' });
        }
    },
    getRoundStatuses: async (req, res) => {
        try {
            // Trả trạng thái khóa/xác nhận của từng cặp bus-round cho các màn transaction/round.
            const tripId = Number(req.query.tripId);
            if (!tripId) {
                return res.status(400).json({ message: 'Thiếu thông tin chuyến xe (tripId)' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Không có quyền truy cập' });
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
            res.status(500).json({ message: 'Lỗi hệ thống' });
        }
    },
    confirmCompletion: async (req, res) => {
        try {
            // Tài xế xác nhận xe đã hoàn thành một chặng, sau đó không cho thêm khách mới vào chặng đó.
            const busId = Number(req.params.busId);
            const roundId = Number(req.params.roundId);
            if (!busId || !roundId) {
                return res.status(400).json({ message: 'Thiếu thông tin xe (busId) hoặc chặng (roundId)' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Không có quyền truy cập' });
            }
            const actorId = await resolveActorId(req);
            if (!actorId) {
                return res.status(401).json({ message: 'Không có quyền truy cập' });
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
                return res.status(404).json({ message: 'Không tìm thấy xe' });
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
                return res.status(404).json({ message: 'Không tìm thấy chặng' });
            }
            const status = await db_1.prisma.busRoundStatus.findUnique({
                where: { busId_roundId: { busId, roundId } },
            });
            if (!status?.checkInLocked || !status.checkOutLocked) {
                return res.status(400).json({
                    message: 'Phải khóa cả lượt đi và lượt về trước khi hoàn thành chặng',
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
            res.status(500).json({ message: 'Lỗi hệ thống' });
        }
    },
    confirmChecks: async (req, res) => {
        try {
            // Admin khóa hoặc mở khóa check-in/check-out cho một xe ở một chặng cụ thể.
            const busId = Number(req.params.busId);
            const roundId = Number(req.params.roundId);
            if (!busId || !roundId) {
                return res.status(400).json({ message: 'Thiếu thông tin xe (busId) hoặc chặng (roundId)' });
            }
            if (!req.tenantId) {
                return res.status(401).json({ message: 'Không có quyền truy cập' });
            }
            const { checkInLocked, checkOutLocked } = req.body;
            const nextCheckInLocked = checkInLocked === undefined ? undefined : Boolean(checkInLocked);
            const nextCheckOutLocked = checkOutLocked === undefined ? undefined : Boolean(checkOutLocked);
            const now = new Date();
            const existingBus = await db_1.prisma.bus.findFirst({ where: { id: busId, trip: { tenantId: req.tenantId } } });
            if (!existingBus) {
                return res.status(404).json({ message: 'Không tìm thấy xe' });
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
            const busInfo = await db_1.prisma.bus.findFirst({
                where: { id: busId, trip: { tenantId: req.tenantId } },
                include: { trip: true },
            });
            if (busInfo?.trip?.id) {
                publishLockUpdate(busInfo.trip.id, busId, roundId, up.checkInLocked, up.checkOutLocked);
            }
            res.json(up);
        }
        catch (error) {
            res.status(500).json({ message: 'Lỗi hệ thống' });
        }
    }
};
