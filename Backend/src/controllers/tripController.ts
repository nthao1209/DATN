import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { publishDashboardRefresh } from '../services/mqtt';
import { prisma } from '../config/db';

enum Status {
  DOING = 'DOING',
  DONE = 'DONE'
}

const getTripCompletionCounts = async (tripId: number, tenantId: number) => {
  const [roundCount, completedRoundCount] = await Promise.all([
    prisma.round.count({
      where: {
        tripId,
        trip: {
          tenantId,
        },
      },
    }),
    prisma.round.count({
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

export const tripController = {
  getAll: async (req: AuthRequest, res: Response) => {
    const tenantId = req.tenantId

    if (!tenantId) {
       return res.status(400).json({ message: 'Missing tenantId' });
    }
    const trips = await prisma.trip.findMany({
      where: { tenantId },
      include: {
        _count: { select: { buses: true, rounds: true } },
        rounds: {
          select: { status: true },
        },
      }
    });
    res.json(
      trips.map((trip) => ({
        ...trip,
        completedRoundCount: trip.rounds.filter((round) => round.status === Status.DONE).length,
      }))
    );
  },

  create: async (req: AuthRequest, res: Response) => {
    const tenantId = req.tenantId
    if (!tenantId) {
       return res.status(400).json({ message: 'Missing tenantId' });
    }
    const { name, status } = req.body;
    const trip = await prisma.trip.create({
      data: { name, status, tenantId }
    });
    publishDashboardRefresh(tenantId, {
      type: 'dashboard.refresh',
      entity: 'trip',
      action: 'create',
      tripId: trip.id,
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json(trip);
  },

  update: async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, status } = req.body;

    if (!req.tenantId) {
      return res.status(401).json({ message: 'Missing tenantId' });
    }

    const existing = await prisma.trip.findFirst({
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

    const updated = await prisma.trip.update({
      where: { id: Number(id) },
      data: { name, status }
    });
    publishDashboardRefresh(req.tenantId, {
      type: 'dashboard.refresh',
      entity: 'trip',
      action: 'update',
      tripId: updated.id,
      updatedAt: new Date().toISOString(),
    });
    res.json(updated);
  },

  delete: async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const tenantId = req.tenantId;
    await prisma.trip.delete({ where: { id: Number(id) } });
    if (tenantId) {
      publishDashboardRefresh(tenantId, {
        type: 'dashboard.refresh',
        entity: 'trip',
        action: 'delete',
        tripId: Number(id),
        updatedAt: new Date().toISOString(),
      });
    }
    res.json({ message: "Deleted" });
  }
};