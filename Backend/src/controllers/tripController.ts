import { Response } from 'express';
import { Prisma } from '@prisma/client';
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
       return res.status(400).json({ message: 'Thiếu thông tin tổ chức (tenantId)' });
    }
    const managerTripFilter = req.roleId === 3 && req.user?.id
      ? {
          buses: {
            some: {
              managerId: req.user.id,
            },
          },
        }
      : {};

    const trips = await prisma.trip.findMany({
      where: {
        tenantId,
        ...managerTripFilter,
      },
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
       return res.status(400).json({ message: 'Thiếu thông tin tổ chức (tenantId)' });
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
      return res.status(401).json({ message: 'Thiếu thông tin tổ chức (tenantId)' });
    }

    const existing = await prisma.trip.findFirst({
      where: {
        id: Number(id),
        tenantId: req.tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Không tìm thấy chuyến xe' });
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
    try {
      const tripId = Number(req.params.id);
      const tenantId = req.tenantId;

      if (!tripId) {
        return res.status(400).json({ message: 'Thiếu mã chuyến xe (tripId)' });
      }

      if (!tenantId) {
        return res.status(401).json({ message: 'Thiếu thông tin tổ chức (tenantId)' });
      }

      const existing = await prisma.trip.findFirst({
        where: {
          id: tripId,
          tenantId,
        },
        select: {
          id: true,
          buses: {
            select: { id: true },
          },
          rounds: {
            select: { id: true },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Không tìm thấy chuyến xe' });
      }

      const busIds = existing.buses.map((bus) => bus.id);
      const roundIds = existing.rounds.map((round) => round.id);

      await prisma.$transaction(async (tx) => {
        const unlockRequests = await tx.unlockRequest.findMany({
          where: {
            OR: [
              { busId: { in: busIds } },
              { roundId: { in: roundIds } },
            ],
          },
          select: { id: true },
        });

        const notificationFilters: Prisma.NotificationWhereInput[] = [
          { payload: { path: ['tripId'], equals: tripId } },
          ...busIds.map((busId) => ({ payload: { path: ['busId'], equals: busId } })),
          ...roundIds.map((roundId) => ({ payload: { path: ['roundId'], equals: roundId } })),
          ...unlockRequests.map((request) => ({ payload: { path: ['requestId'], equals: request.id } })),
        ];

        await tx.notification.deleteMany({
          where: {
            OR: notificationFilters,
          },
        });

        await tx.attendanceEvent.deleteMany({
          where: {
            OR: [
              {
                bus: {
                  tripId,
                },
              },
              {
                transaction: {
                  round: {
                    tripId,
                  },
                },
              },
            ],
          },
        });

        await tx.busRoundStatus.deleteMany({
          where: {
            OR: [
              { busId: { in: busIds } },
              { roundId: { in: roundIds } },
            ],
          },
        });

        await tx.unlockRequest.deleteMany({
          where: {
            OR: [
              { busId: { in: busIds } },
              { roundId: { in: roundIds } },
            ],
          },
        });

        await tx.trip.delete({
          where: { id: tripId },
        });
      });

      publishDashboardRefresh(tenantId, {
        type: 'dashboard.refresh',
        entity: 'trip',
        action: 'delete',
        tripId,
        updatedAt: new Date().toISOString(),
      });

      res.json({ message: "Đã xóa" });
    } catch (error: any) {
      res.status(500).json({
        message: error?.message || 'Cannot delete trip',
      });
    }
  }
};
