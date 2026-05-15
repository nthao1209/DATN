import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types/auth';
import mqtt from 'mqtt';

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
  approve,
  reject,
};