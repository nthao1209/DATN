"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = void 0;
const notificationService_1 = require("../services/notificationService");
const db_1 = require("../config/db");
const ensureUser = (req, res) => {
    if (!req.user?.id) {
        res.status(401).json({ message: 'Unauthorized' });
        return null;
    }
    return req.user.id;
};
const list = async (req, res) => {
    try {
        const userId = ensureUser(req, res);
        if (!userId)
            return;
        const unreadOnly = String(req.query.unreadOnly || '') === 'true';
        const type = typeof req.query.type === 'string' ? req.query.type : undefined;
        const tripId = req.query.tripId !== undefined ? Number(req.query.tripId) : undefined;
        const busId = req.query.busId !== undefined ? Number(req.query.busId) : undefined;
        const roundId = req.query.roundId !== undefined ? Number(req.query.roundId) : undefined;
        const limit = Math.min(Number(req.query.limit || 50) || 50, 200);
        const offset = Math.max(Number(req.query.offset || 0) || 0, 0);
        const andConditions = [];
        if (type) {
            andConditions.push({ type });
        }
        if (unreadOnly) {
            andConditions.push({ isRead: false });
        }
        if (Number.isFinite(tripId)) {
            andConditions.push({ payload: { path: ['tripId'], equals: tripId } });
        }
        if (Number.isFinite(busId)) {
            andConditions.push({ payload: { path: ['busId'], equals: busId } });
        }
        if (Number.isFinite(roundId)) {
            andConditions.push({ payload: { path: ['roundId'], equals: roundId } });
        }
        const notifications = await db_1.prisma.notification.findMany({
            where: {
                userId,
                ...(andConditions.length ? { AND: andConditions } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });
        res.json(notifications);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', detail: error?.message });
    }
};
const create = async (req, res) => {
    try {
        const userId = ensureUser(req, res);
        if (!userId)
            return;
        const type = String(req.body?.type || '').trim();
        const title = String(req.body?.title || '').trim();
        const content = String(req.body?.content || '').trim();
        const payload = req.body?.payload ?? null;
        if (!type || !title || !content) {
            return res.status(400).json({ message: 'type, title and content are required' });
        }
        const notification = await (0, notificationService_1.createNotification)(db_1.prisma, {
            userId,
            type,
            title,
            content,
            payload,
        });
        res.status(201).json(notification);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', detail: error?.message });
    }
};
const markRead = async (req, res) => {
    try {
        const userId = ensureUser(req, res);
        if (!userId)
            return;
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'Missing notification id' });
        }
        const notification = await db_1.prisma.notification.findFirst({ where: { id, userId } });
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        const updated = await db_1.prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', detail: error?.message });
    }
};
const markAllRead = async (req, res) => {
    try {
        const userId = ensureUser(req, res);
        if (!userId)
            return;
        const result = await db_1.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', detail: error?.message });
    }
};
const remove = async (req, res) => {
    try {
        const userId = ensureUser(req, res);
        if (!userId)
            return;
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'Missing notification id' });
        }
        const notification = await db_1.prisma.notification.findFirst({ where: { id, userId } });
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        await db_1.prisma.notification.delete({
            where: { id },
        });
        res.json({ message: 'Deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', detail: error?.message });
    }
};
const removeAll = async (req, res) => {
    try {
        const userId = ensureUser(req, res);
        if (!userId)
            return;
        const result = await db_1.prisma.notification.deleteMany({
            where: { userId },
        });
        res.json({ message: 'All notifications deleted', count: result.count });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', detail: error?.message });
    }
};
exports.notificationController = {
    list,
    create,
    markRead,
    markAllRead,
    remove,
    removeAll
};
