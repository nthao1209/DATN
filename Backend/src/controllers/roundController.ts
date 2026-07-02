import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { prisma } from '../config/db';
import { publishDashboardRefresh } from '../services/mqtt';

enum Status {
  DOING = 'DOING',
  DONE = 'DONE'
}

const getCompletedBusCounts = async (tripId: number, roundId: number, tenantId: number) => {
  // Tính tiến độ hoàn thành chặng: bao nhiêu xe đã được tài xế xác nhận.
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
      // Lấy danh sách chặng kèm các số liệu tổng quan mà RoundPage cần hiển thị.
      const tripId = Number(req.params.tripId);

      if (!tripId) {
        return res.status(400).json({ message: 'Thiếu thông tin chuyến xe (tripId)' });
      }
      if (!req.tenantId) {
        return res.status(401).json({ message: 'Không có quyền truy cập' });
      }

      const rounds = await prisma.round.findMany({
          where: {
            tripId,
            trip: {
              tenantId: req.tenantId
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
        // Group theo round để biết mỗi chặng đã có bao nhiêu xe hoàn thành.
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
        message: 'Lỗi hệ thống',
        detail: error.message
      });
    }
  },

  // Tạo round mới
  create: async (req: AuthRequest, res: Response) => {
    try {
      // Tạo chặng mới và trả kèm số hành khách/xe hiện tại để frontend cập nhật bảng ngay.
      const tripId = Number(req.params.tripId);

      if (!tripId) {
        return res.status(400).json({ message: 'Thiếu thông tin chuyến xe (tripId)' });
      }
      if (!req.tenantId) {
        return res.status(401).json({ message: 'Không có quyền truy cập' });
      }


      const name = String(req.body?.name ?? '').trim();
      const time = String(req.body?.time ?? '').trim();
      const statusRaw = String(req.body?.status ?? '').trim().toUpperCase();

      if (!name || !time || !statusRaw) {
        return res.status(400).json({ message: 'Thiếu các trường bắt buộc: name, time, status' });
      }

      if (statusRaw !== Status.DOING && statusRaw !== Status.DONE) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ. Chỉ cho phép: DOING, DONE' });
      }

      const trip = await prisma.trip.findFirst({
        where: {
          id: tripId,
          tenantId: req.tenantId,
        },
      });

      if (!trip) {
        return res.status(404).json({ message: 'Không tìm thấy chuyến xe' });
      }

      const round = await prisma.round.create({
        data: {
          name,
          status: statusRaw as Status,
          time,
          tripId
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

      const createdRoundWithStats = { ...round, passengerCount, busCount, completedBusCount };

      publishDashboardRefresh(req.tenantId, {
        type: 'dashboard.refresh',
        entity: 'round',
        action: 'create',
        tripId,
        roundId: round.id,
        updatedAt: new Date().toISOString(),
      });

      res.status(201).json(createdRoundWithStats);
    } catch (error: any) {


      if (error.code === 'P2000' || error.code === 'P2002') {
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
      }

      res.status(500).json({ message: 'Lỗi hệ thống', detail: error?.message });
    }
  },

  // Update round
  update: async (req: AuthRequest, res: Response) => {
    try {
      // Cập nhật thông tin chặng; nếu đổi status thì trả thêm tiến độ xe hoàn thành.
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: 'Thiếu mã chặng (roundId)' });
      }
      if (!req.tenantId) {
        return res.status(401).json({ message: 'Không có quyền truy cập' });
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
        return res.status(404).json({ message: 'Không tìm thấy vòng' });
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

      publishDashboardRefresh(req.tenantId, {
        type: 'dashboard.refresh',
        entity: 'round',
        action: 'update',
        tripId: existing.tripId,
        roundId: updated.id,
        updatedAt: new Date().toISOString(),
      });

      res.json(updated);
    } catch (error) {

      res.status(500).json({ message: 'Lỗi hệ thống' });
    }
  },

  // Xóa round
  delete: async (req: AuthRequest, res: Response) => {
    try {
      // Xóa chặng thuộc tenant hiện tại và phát sự kiện refresh dashboard.
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: 'Thiếu mã chặng (roundId)' });
      }
      if (!req.tenantId) {
        return res.status(401).json({ message: 'Không có quyền truy cập' });
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
        return res.status(404).json({ message: 'Không tìm thấy vòng' });
      }

      await prisma.round.delete({
        where: { id: Number(id) }
      });

      publishDashboardRefresh(req.tenantId, {
        type: 'dashboard.refresh',
        entity: 'round',
        action: 'delete',
        tripId: existing.tripId,
        roundId: Number(id),
        updatedAt: new Date().toISOString(),
      });

      res.json({ message: 'Đã xóa thành công' });
    } catch (error) {

      res.status(500).json({ message: 'Lỗi hệ thống' });
    }
  }
};
