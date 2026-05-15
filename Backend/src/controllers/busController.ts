import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types/auth';
import mqtt from 'mqtt';

const prisma = new PrismaClient();

const mqttClient = mqtt.connect(process.env.MQTT_URL || 'wss://mqtt.toolhub.app:8084', {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clean: true,
  clientId: `backend_bus_${Date.now()}_${Math.random().toString(16).slice(2)}`,
});

const publishToAdmin = (tripId: number, payload: any) => {
  const topic = `attendance/admin/unlock-requests/${tripId}`;

  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
  console.log(`[Bus] Published admin notification to ${topic}:`, payload);
};

const publishLockUpdate = (tripId: number, busId: number, roundId: number, checkInLocked: boolean, checkOutLocked: boolean) => {
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

export const busController = {
  getAll: async (req: AuthRequest, res: Response) => {
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

    const buses = await prisma.bus.findMany({
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

  create: async (req: AuthRequest, res: Response) => {
    try {
      const tripId = Number(req.params.tripId);

      if (!tripId) {
        return res.status(400).json({ message: 'Missing tripId' });
      }

      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const {
        registrationNumber,
        busCode,
        driverName,
        driverTel,
        tourGuideName,
        tourGuideTel,
        description,
        managerId,
      } = req.body;

      if (!registrationNumber || !busCode || !driverName || !driverTel || !tourGuideName || !tourGuideTel) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const data: any = {
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
    } catch (error: any) {
      console.error('create bus error:', {
        message: error.message,
        code: error.code,
        meta: error.meta
      });
      res.status(500).json({ message: 'Server error', detail: error.message });
    }
  },

  update: async (req: AuthRequest, res: Response) => {
    try{
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Missing  id' });
    }
    if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
      registrationNumber,
      busCode,
      driverName,
      driverTel,
      tourGuideName,
      tourGuideTel,
      description,
      managerId
    } = req.body;


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
    } catch (error) {
      console.error('update bus error:', error);
      res.status(500).json({ message: 'Server error' });
      }
    },

  delete: async (req: AuthRequest, res: Response) => {
    try{
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
    } catch (error) {
      console.error('delete bus error:', error);
      res.status(500).json({ message: 'Server error' });}
  },

  getBusManagers: async (req: AuthRequest, res: Response) => {
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
  } catch (error) {
    console.error('get bus managers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
  ,
  getRoundStatuses: async (req: AuthRequest, res: Response) => {
    try {
      const tripId = Number(req.query.tripId);
      if (!tripId) {
        return res.status(400).json({ message: 'Missing tripId' });
      }
      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const statuses = await prisma.busRoundStatus.findMany({
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
    } catch (error) {
      console.error('getRoundStatuses error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  confirmChecks: async (req: AuthRequest, res: Response) => {
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

      const existingBus = await prisma.bus.findFirst({ where: { id: busId, trip: { tenantId: req.tenantId } } });
      if (!existingBus) {
        return res.status(404).json({ message: 'Bus not found' });
      }

      const up = await prisma.busRoundStatus.upsert({
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
        prisma.bus.findFirst({
          where: { id: busId, trip: { tenantId: req.tenantId } },
          include: { trip: true },
        }),
        prisma.round.findFirst({ where: { id: roundId } }),
      ]);

      if (busInfo?.trip?.id) {
        publishToAdmin(busInfo.trip.id, {
          type: 'round.lock.changed',
          busId,
          busCode: busInfo.busCode,
          roundId,
          roundName: roundInfo?.name,
          checkInLocked: up.checkInLocked,
          checkOutLocked: up.checkOutLocked,
          lockedBy: req.user?.name || req.user?.email || String(req.user?.id || ''),
          tripId: busInfo.trip.id,
        });

        publishLockUpdate(busInfo.trip.id, busId, roundId, up.checkInLocked, up.checkOutLocked);
      }

      res.json(up);
    } catch (error) {
      console.error('confirmChecks error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};