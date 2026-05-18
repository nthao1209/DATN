import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types/auth';
import mqtt from 'mqtt';
import { createNotification, createNotificationsForUsers, getTenantNotificationRecipients } from '../services/notificationService';

const prisma = new PrismaClient();

const mqttClient = mqtt.connect(
  process.env.MQTT_URL || 'wss://mqtt.toolhub.app:8084',
  {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clean: true,
    clientId: `backend_${Date.now()}_${Math.random().toString(16).slice(2)}`
  }
);

const publish = (topic: string, payload: any) => {
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
};

const buildUnlockTitle = (status: 'PENDING' | 'APPROVED' | 'REJECTED') => {
  if (status === 'PENDING') return 'Yêu cầu mở khóa mới';
  if (status === 'APPROVED') return 'Yêu cầu mở khóa đã được duyệt';
  return 'Yêu cầu mở khóa bị từ chối';
};

const buildUnlockContent = (request: any, busCode?: string, roundName?: string, extra?: string) => {
  const actionLabel = request.type === 'check_in' ? 'điểm danh vào' : 'điểm danh ra';
  const base = `Xe ${busCode || request.bus?.busCode || request.busId} yêu cầu mở khóa ${actionLabel} cho chặng ${roundName || request.round?.name || request.roundId}`;
  return extra ? `${base}. ${extra}` : `${base}.`;
};

const create = async (req: AuthRequest, res: Response) => {
  try {
    const busId = Number(req.params.busId);
    const roundId = Number(req.params.roundId);
    const { type = 'check_in', reason } = req.body || {};

    if (!busId || !roundId) {
      return res.status(400).json({ message: 'Missing busId or roundId' });
    }
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!req.tenantId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const bus = await prisma.bus.findFirst({
      where: { id: busId, trip: { tenantId: req.tenantId } },
      include: { trip: true, manager: true },
    });

    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    const round = await prisma.round.findFirst({
      where: { id: roundId, trip: { tenantId: req.tenantId } },
    });

    if (!round) {
      return res.status(404).json({ message: 'Round not found' });
    }

    const request = await prisma.unlockRequest.upsert({
      where: { busId_roundId_type: { busId, roundId, type } },
      create: {
        busId,
        roundId,
        type,
        reason: reason ? String(reason) : null,
        requestedBy: req.user.id,
        status: 'PENDING',
      },
      update: {
        reason: reason ? String(reason) : null,
        requestedBy: req.user.id,
        status: 'PENDING',
        approvedBy: null,
        respondedAt: null,
      },
      include: {
        bus: { include: { trip: true } },
        round: true,
      },
    });

    // Notify tenant admins only (roleId = 2)
    let recipientIds = await getTenantNotificationRecipients(prisma, req.tenantId, [2]);
    // exclude requester from admin recipients if any
    recipientIds = recipientIds.filter((id) => id !== req.user?.id);
    if (recipientIds.length) {
      await createNotificationsForUsers(prisma, recipientIds, {
        type: 'unlock.request.created',
        title: buildUnlockTitle('PENDING'),
        content: buildUnlockContent(request, bus.busCode, round.name, reason ? `Lý do: ${reason}` : ''),
        payload: {
          requestId: request.id,
          busId,
          roundId,
          tripId: bus.trip.id,
          lockType: type,
        },
      });
    }

    // Notify requester about successful send
    if (req.user?.id) {
      await createNotification(prisma, {
        userId: req.user.id,
        type: 'unlock.request.created.self',
        title: 'Yêu cầu mở khóa đã được gửi',
        content: `Yêu cầu mở khóa đã gửi cho chặng ${round.name} (Xe ${bus.busCode}).`,
        payload: {
          requestId: request.id,
          busId,
          roundId,
          tripId: bus.trip.id,
          lockType: type,
        },
      });
    }

    publish(`attendance/ui/trip/${bus.trip.id}`, {
      type: 'unlock.request.created',
      requestId: request.id,
      busId,
      busCode: bus.busCode,
      roundId,
      roundName: round.name,
      lockType: type,
      reason: reason || '',
      tripId: bus.trip.id,
    });

    return res.status(201).json(request);
  } catch (error: any) {
    console.error('create unlock request error:', error);
    return res.status(500).json({ message: error.message });
  }
};


const approve = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = Number(req.params.requestId);

    if (!requestId) return res.status(400).json({ message: 'Missing requestId' });
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.tenantId) return res.status(401).json({ message: 'Unauthorized' });

    // 1. Get request
    const request = await prisma.unlockRequest.findUnique({
      where: { id: requestId },
      include: { bus: { include: { trip: true } } }
    });

    if (!request) {
      return res.status(404).json({ message: 'Unlock request not found' });
    }

    if (request.bus.trip.tenantId !== req.tenantId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // 2. Update BOTH tables (transaction)
    const updated = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.unlockRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedBy: req.user?.id,
          respondedAt: new Date(),
        }
      });

      await tx.busRoundStatus.update({
        where: {
          busId_roundId: {
            busId: request.busId,
            roundId: request.roundId,
          }
        },
        data: request.type === 'check_in'
          ? {
              checkInLocked: false,
              checkInAt: null,
            }
          : {
              checkOutLocked: false,
              checkOutAt: null,
            }
      });

      return updatedRequest;
    });

    // Notify requester only
    await createNotification(prisma, {
      userId: request.requestedBy,
      type: 'unlock.request.approved',
      title: buildUnlockTitle('APPROVED'),
      content: buildUnlockContent(request, request.bus.busCode, undefined, `Đã được phê duyệt bởi ${req.user.name || req.user.email || req.user.id}`),
      payload: {
        requestId,
        busId: request.busId,
        roundId: request.roundId,
        tripId: request.bus.trip.id,
        approvedBy: req.user.id,
      },
    });

    // 3. Notify realtime UI (KHÔNG chờ worker)
    publish(`attendance/ui/trip/${request.bus.trip.id}`, {
      type: 'unlock.request.approved',
      requestId,
      busId: request.busId,
      roundId: request.roundId,
      lockType: request.type,
      approvedBy: req.user.id,
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('approve unlock error:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * REJECT unlock request
 */
const reject = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = Number(req.params.requestId);
    const { rejectReason } = req.body;

    if (!requestId) return res.status(400).json({ message: 'Missing requestId' });
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.tenantId) return res.status(401).json({ message: 'Unauthorized' });

    const request = await prisma.unlockRequest.findUnique({
      where: { id: requestId },
      include: { bus: { include: { trip: true } } }
    });

    if (!request) {
      return res.status(404).json({ message: 'Unlock request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.unlockRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          approvedBy: req.user?.id,
          respondedAt: new Date(),
        }
      });

      return updatedRequest;
    });

    // Notify requester only
    await createNotification(prisma, {
      userId: request.requestedBy,
      type: 'unlock.request.rejected',
      title: buildUnlockTitle('REJECTED'),
      content: buildUnlockContent(request, request.bus.busCode, undefined, `Lý do: ${rejectReason || 'Không có'}`),
      payload: {
        requestId,
        busId: request.busId,
        roundId: request.roundId,
        tripId: request.bus.trip.id,
        rejectedBy: req.user.id,
        rejectReason: rejectReason || '',
      },
    });

    publish(`attendance/ui/trip/${request.bus.trip.id}`, {
      type: 'unlock.request.rejected',
      requestId,
      busId: request.busId,
      roundId: request.roundId,
      lockType: request.type,
      rejectedBy: req.user.id,
      rejectReason: rejectReason || '',
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('reject unlock error:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const unlockRequestController = {
  create,
  approve,
  reject,
};