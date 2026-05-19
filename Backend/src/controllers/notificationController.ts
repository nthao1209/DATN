import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types/auth';
import { createNotification } from '../services/notificationService';

const prisma = new PrismaClient();

const ensureUser = (req: AuthRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  return req.user.id;
};

const list = async (req: AuthRequest, res: Response) => {
  try {
    const userId = ensureUser(req, res);
    if (!userId) return;

    const unreadOnly = String(req.query.unreadOnly || '') === 'true';
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const tripId = req.query.tripId !== undefined ? Number(req.query.tripId) : undefined;
    const busId = req.query.busId !== undefined ? Number(req.query.busId) : undefined;
    const roundId = req.query.roundId !== undefined ? Number(req.query.roundId) : undefined;
    const limit = Math.min(Number(req.query.limit || 50) || 50, 200);
    const offset = Math.max(Number(req.query.offset || 0) || 0, 0);

    const andConditions: any[] = [];

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

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(andConditions.length ? { AND: andConditions } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    res.json(notifications);
  } catch (error: any) {
    console.error('list notifications error:', error);
    res.status(500).json({ message: 'Server error', detail: error?.message });
  }
};

const create = async (req: AuthRequest, res: Response) => {
  try {
    const userId = ensureUser(req, res);
    if (!userId) return;

    const type = String(req.body?.type || '').trim();
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    const payload = req.body?.payload ?? null;

    if (!type || !title || !content) {
      return res.status(400).json({ message: 'type, title and content are required' });
    }

    const notification = await createNotification(prisma, {
      userId,
      type,
      title,
      content,
      payload,
    });

    res.status(201).json(notification);
  } catch (error: any) {
    console.error('create notification error:', error);
    res.status(500).json({ message: 'Server error', detail: error?.message });
  }
};

const markRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = ensureUser(req, res);
    if (!userId) return;

    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Missing notification id' });
    }

    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('mark read notification error:', error);
    res.status(500).json({ message: 'Server error', detail: error?.message });
  }
};

const markAllRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = ensureUser(req, res);
    if (!userId) return;

    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json(result);
  } catch (error: any) {
    console.error('mark all notifications read error:', error);
    res.status(500).json({ message: 'Server error', detail: error?.message });
  }
};
const remove = async (req: AuthRequest, res: Response) => {
  try {
    const userId = ensureUser(req, res);
    if (!userId) return;

    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Missing notification id' });
    }

    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    console.error('delete notification error:', error);
    res.status(500).json({ message: 'Server error', detail: error?.message });
  }
};

const removeAll = async (req: AuthRequest, res: Response) => {
  try {
    const userId = ensureUser(req, res);
    if (!userId) return;

    const result = await prisma.notification.deleteMany({
      where: { userId },
    });

    res.json({ message: 'All notifications deleted', count: result.count });
  } catch (error: any) {
    console.error('delete all notifications error:', error);
    res.status(500).json({ message: 'Server error', detail: error?.message });
  }
};


export const notificationController = {
  list,
  create,
  markRead,
  markAllRead,
  remove,
  removeAll
};
