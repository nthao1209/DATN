import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { prisma } from '../config/db';

enum Status {
  DOING = 'DOING',
  DONE = 'DONE'
}

const getCompletedBusCounts = async (tripId: number, roundId: number, tenantId: number) => {
  const [busCount, completedBusCount] = await Promise.all([
    prisma.bus.count({
      where: {
        tripId,
        trip: {
          tenantId,
        },
      },
    }),
    prisma.busRoundStatus.count({
      where: {
        roundId,
        round: {
          tripId,
          trip: {
            tenantId,
          },
        },
        driverConfirmedBy: {
          not: null,
        },
      },
    }),
  ]);

  return { busCount, completedBusCount };
};

export const roundController = {
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const tripId = Number(req.params.tripId);

      if (!tripId) {
        return res.status(400).json({ message: 'Missing tripId' });
      }
      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const rounds = await prisma.round.findMany({
          where: {
            tripId,
            trip: {
              tenantId: req.tenantId
            }
          },
          include: {
            _count: {
              select: {
                transactions: true
              }
            }
          },
          orderBy: {
            id: 'desc'
          }          
        });

      const [passengerCount, busCount] = await Promise.all([
        prisma.passenger.count({
          where: {
            bus: {
              tripId,
              trip: {
                tenantId: req.tenantId,
              },
            },
          },
        }),
        prisma.bus.count({
          where: {
            tripId,
            trip: {
              tenantId: req.tenantId,
            },
          },
        }),
      ]);

      const completedBusCountByRound = await prisma.busRoundStatus.groupBy({
        by: ['roundId'],
        where: {
          round: {
            tripId,
            trip: {
              tenantId: req.tenantId,
            },
          },
          driverConfirmedBy: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      });

      const completedCountMap = new Map<number, number>(
        completedBusCountByRound.map((item) => [Number(item.roundId), Number(item._count._all)])
      );

      const roundsWithStats = rounds.map((round) => ({
        ...round,
        passengerCount,
        busCount,
        completedBusCount: completedCountMap.get(Number(round.id)) ?? 0,
      }));

      res.json(roundsWithStats);
    } catch (error: any) {      
      res.status(500).json({
        message: 'Server error',
        detail: error.message
      });
    }
  },

  // Tạo round mới
  create: async (req: AuthRequest, res: Response) => {
    try {
      const tripId = Number(req.params.tripId);

      if (!tripId) {
        return res.status(400).json({ message: 'Missing tripId' });
      }
      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }


      const name = String(req.body?.name ?? '').trim();
      const time = String(req.body?.time ?? '').trim();
      const statusRaw = String(req.body?.status ?? '').trim().toUpperCase();

      if (!name || !time || !statusRaw) {
        return res.status(400).json({ message: 'Missing required fields: name, time, status' });
      }

      if (statusRaw !== Status.DOING && statusRaw !== Status.DONE) {
        return res.status(400).json({ message: 'Invalid status. Allowed values: DOING, DONE' });
      }

      const trip = await prisma.trip.findFirst({
        where: {
          id: tripId,
          tenantId: req.tenantId,
        },
      });

      if (!trip) {
        return res.status(404).json({ message: 'Trip not found' });
      }

      const round = await prisma.round.create({
        data: {
          name,
          status: statusRaw as Status,
          time,
          tripId
        }
      });

      const createdRound = await prisma.round.findUnique({
        where: { id: round.id },
        include: {
          _count: {
            select: {
              transactions: true
            }
          }
        }
      });

      const [passengerCount, busCount, completedBusCount] = await Promise.all([
        prisma.passenger.count({
          where: {
            bus: {
              tripId,
              trip: {
                tenantId: req.tenantId,
              },
            },
          },
        }),
        prisma.bus.count({
          where: {
            tripId,
            trip: {
              tenantId: req.tenantId,
            },
          },
        }),
        prisma.busRoundStatus.count({
          where: {
            round: {
              tripId,
              trip: {
                tenantId: req.tenantId,
              },
            },
            driverConfirmedBy: {
              not: null,
            },
          },
        }),
      ]);

      const createdRoundWithStats = createdRound
        ? { ...createdRound, passengerCount, busCount, completedBusCount }
        : { ...round, _count: { transactions: 0 }, passengerCount, busCount, completedBusCount };

      res.status(201).json(createdRoundWithStats);
    } catch (error: any) {
      console.error(' create round error:', error);

      if (error.code === 'P2000' || error.code === 'P2002') {
        return res.status(400).json({ message: 'Invalid data' });
      }

      res.status(500).json({ message: 'Server error', detail: error?.message });
    }
  },

  // Update round
  update: async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: 'Missing round id' });
      }
      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { name, time, status } = req.body;

      // Check round exists and verify tenant access through trip
      const existing = await prisma.round.findFirst({
        where: {
          id: Number(id),
          trip: {
            tenantId: req.tenantId
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ message: 'Round not found' });
      }

      if (status !== undefined && String(status).trim().toUpperCase() === Status.DONE) {
        const { busCount, completedBusCount } = await getCompletedBusCounts(
          existing.tripId,
          Number(id),
          req.tenantId,
        );

        if (completedBusCount !== busCount) {
          return res.status(400).json({
            message: 'Chặng chỉ được hoàn thành khi tất cả xe đã hoàn thành chặng',
          });
        }
      }

      const updated = await prisma.round.update({
        where: { id: Number(id) },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(status !== undefined ? { status: String(status).trim().toUpperCase() as Status } : {}),
          ...(time !== undefined ? { time: String(time).trim() } : {}),
        }
      });

      res.json(updated);
    } catch (error) {
      console.error('update round error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Xóa round
  delete: async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: 'Missing round id' });
      }
      if (!req.tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const existing = await prisma.round.findFirst({
        where: {
          id: Number(id),
          trip: {
            tenantId: req.tenantId
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ message: 'Round not found' });
      }

      await prisma.round.delete({
        where: { id: Number(id) }
      });

      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      console.error('delete round error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};