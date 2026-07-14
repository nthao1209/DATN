import { AttendanceAction } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../config/db";
import { AuthRequest } from "../types/auth";

// Tất cả transaction phải nằm trong tenant hiện tại để tránh lộ dữ liệu giữa tổ chức.
const ensureTenant = (req: AuthRequest, res: Response): number | null => {
  if (!req.tenantId) {
    res.status(401).json({ message: "Không có quyền truy cập" });
    return null;
  }

  return req.tenantId;
};

const ROLE_IDS = {
  ADMIN: 2,
  BUS_MANAGEMENT: 3,
} as const;

const canViewTransactions = (req: AuthRequest) =>
  [ROLE_IDS.ADMIN, ROLE_IDS.BUS_MANAGEMENT].includes(Number(req.roleId) as 2 | 3);

const canMutateTransactions = (req: AuthRequest) =>
  Number(req.roleId) === ROLE_IDS.BUS_MANAGEMENT;

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return false;
};

const readTrimmedString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

// Nếu body có tick điểm danh hoặc ghi chú thì request này được xem là thao tác attendance.
const hasAttendanceMutationInput = (body: any) =>
  parseBoolean(body?.checkIn) ||
  parseBoolean(body?.checkOut) ||
  Boolean(readTrimmedString(body?.checkInNote)) ||
  Boolean(readTrimmedString(body?.checkOutNote)) ||
  Boolean(readTrimmedString(body?.note)) ||
  Boolean(body?.checkInAt) ||
  Boolean(body?.checkOutAt);

const getBusDisplayName = async (busId: number) => {
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    select: { busCode: true, registrationNumber: true },
  });

  return bus?.busCode || bus?.registrationNumber || `xe ${busId}`;
};

// Kiểm tra một khách có đang được điểm danh ở xe khác trong cùng chặng hay không.
const getActiveAttendanceBusConflict = async (
  transactionId: number | undefined,
  targetBusId: number,
  roundId: number,
) => {
  if (!transactionId) {
    return {
      blocked: false,
      allowTransferForCheckOut: false,
    };
  }

  const [latestAttendanceEvent, latestCheckInEvent, latestCheckOutEvent] =
    await Promise.all([
      prisma.attendanceEvent.findFirst({
        where: {
          transactionId,
          action: {
            in: [
              AttendanceAction.CHECK_IN_ON,
              AttendanceAction.CHECK_IN_OFF,
              AttendanceAction.CHECK_OUT_ON,
              AttendanceAction.CHECK_OUT_OFF,
            ],
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { action: true, busId: true },
      }),
      prisma.attendanceEvent.findFirst({
        where: {
          transactionId,
          action: {
            in: [
              AttendanceAction.CHECK_IN_ON,
              AttendanceAction.CHECK_IN_OFF,
            ],
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { action: true, busId: true },
      }),
      prisma.attendanceEvent.findFirst({
        where: {
          transactionId,
          action: {
            in: [
              AttendanceAction.CHECK_OUT_ON,
              AttendanceAction.CHECK_OUT_OFF,
            ],
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { action: true, busId: true },
      }),
    ]);

  if (
    !latestAttendanceEvent ||
    Number(latestAttendanceEvent.busId) === Number(targetBusId)
  ) {
    return {
      blocked: false,
      allowTransferForCheckOut: false,
    };
  }

  const isCurrentlyCheckedInElsewhere =
    latestCheckInEvent?.action === AttendanceAction.CHECK_IN_ON &&
    Number(latestCheckInEvent.busId) !== Number(targetBusId);

  const isAlreadyCheckedOutElsewhere =
    latestCheckOutEvent?.action === AttendanceAction.CHECK_OUT_ON &&
    Number(latestCheckOutEvent.busId) !== Number(targetBusId);

  if (isAlreadyCheckedOutElsewhere) {
    return {
      blocked: true,
      code: "PASSENGER_ALREADY_CHECKED_OUT_ON_ANOTHER_BUS",
      busId: Number(latestCheckOutEvent.busId),
      busName: await getBusDisplayName(Number(latestCheckOutEvent.busId)),
      message: `Passenger is already checked out on ${await getBusDisplayName(
        Number(latestCheckOutEvent.busId),
      )}.`,
    };
  }

  if (!isCurrentlyCheckedInElsewhere || !latestCheckInEvent?.busId) {
    return {
      blocked: false,
      allowTransferForCheckOut: false,
    };
  }

  const sourceBusRoundStatus = await prisma.busRoundStatus.findUnique({
    where: {
      busId_roundId: {
        busId: Number(latestCheckInEvent.busId),
        roundId,
      },
    },
    select: {
      checkInLocked: true,
      driverConfirmedBy: true,
    },
  });

  if (sourceBusRoundStatus?.checkInLocked) {
    return {
      blocked: false,
      allowTransferForCheckOut: true,
      sourceBusId: Number(latestCheckInEvent.busId),
      sourceBusName: await getBusDisplayName(Number(latestCheckInEvent.busId)),
    };
  }

  return {
    blocked: true,
    code: "PASSENGER_ALREADY_CHECKED_IN_ON_ANOTHER_BUS",
    busId: Number(latestCheckInEvent.busId),
    busName: await getBusDisplayName(Number(latestCheckInEvent.busId)),
    message: `Passenger is already checked in on ${await getBusDisplayName(
      Number(latestCheckInEvent.busId),
    )}. Lock check-in on that bus before adding this passenger to another bus for check-out.`,
  };
};

// Không cho thêm/chuyển khách vào xe-chặng đã được tài xế xác nhận hoàn tất.
const getTargetBusRoundCompletion = async (busId: number, roundId: number) =>
  prisma.busRoundStatus.findUnique({
    where: {
      busId_roundId: {
        busId,
        roundId,
      },
    },
    select: {
      driverConfirmedBy: true,
      checkOutLocked: true,
    },
  });

export const transactionController = {
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      // Lấy transaction kèm passenger/round/bus/events để frontend dựng bảng điểm danh đầy đủ.
      const tenantId = ensureTenant(req, res);
      if (!tenantId) return;

      if (!canViewTransactions(req)) {
        return res.status(403).json({ message: "Từ chối truy cập (Forbidden)" });
      }

      const managerCondition =
        // Role quản lý xe chỉ thấy xe mình quản lý hoặc hành khách/event liên quan đến xe đó.
        req.roleId === 3 && req.user?.id
          ? {
              OR: [
                {
                  bus: {
                    managerId: req.user.id,
                    trip: { tenantId },
                  },
                },
                {
                  passenger: {
                    bus: {
                      managerId: req.user.id,
                      trip: { tenantId },
                    },
                  },
                },
                {
                  events: {
                    some: {
                      bus: {
                        managerId: req.user.id,
                        trip: { tenantId },
                      },
                    },
                  },
                },
              ],
            }
          : {
              bus: {
                trip: { tenantId },
              },
            };

      const transactions = await prisma.transaction.findMany({
        where: managerCondition,
        include: {
          passenger: {
            include: {
              bus: {
                select: {
                  id: true,
                  busCode: true,
                  registrationNumber: true,
                },
              },
            },
          },
          round: true,
          events: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
          bus: {
            select: {
              id: true,
              busCode: true,
              registrationNumber: true,
            },
          },
        },
        orderBy: [{ roundId: "asc" }, { busId: "asc" }, { passengerId: "asc" }],
      });

      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: "Lỗi hệ thống", detail: error?.message });
    }
  },

  create: async (req: AuthRequest, res: Response) => {
    try {
      // Endpoint này chỉ thêm khách vào bảng; tick điểm danh thật đi qua MQTT worker.
      const tenantId = ensureTenant(req, res);
      if (!tenantId) return;

      if (!canMutateTransactions(req)) {
        return res.status(403).json({ message: "Từ chối truy cập (Forbidden)" });
      }

      if (hasAttendanceMutationInput(req.body)) {
        return res.status(400).json({
          code: "ATTENDANCE_MUST_USE_MQTT",
          message:
            "Attendance changes must be synced through MQTT worker. This endpoint only adds a passenger placeholder to the attendance table.",
        });
      }

      const busId = Number(req.body?.busId);
      const roundId = Number(req.body?.roundId);
      const passengerId = Number(req.body?.passengerId);

      if (!busId || !roundId || !passengerId) {
        return res
          .status(400)
          .json({ message: "busId, roundId, passengerId are required" });
      }

      const bus = await prisma.bus.findFirst({
        where: { id: busId, trip: { tenantId } },
        select: { id: true, tripId: true },
      });

      if (!bus) {
        return res.status(404).json({ message: "Không tìm thấy xe" });
      }

      const round = await prisma.round.findFirst({
        where: { id: roundId, trip: { tenantId } },
        select: { id: true, tripId: true },
      });

      if (!round) {
        return res.status(404).json({ message: "Không tìm thấy chặng" });
      }

      if (Number(round.tripId) !== Number(bus.tripId)) {
        return res
          .status(400)
          .json({ message: "Chặng không thuộc chuyến xe đã chọn" });
      }

      const passenger = await prisma.passenger.findFirst({
        where: {
          id: passengerId,
          bus: { trip: { tenantId } },
        },
        select: { id: true },
      });

      if (!passenger) {
        return res.status(404).json({ message: "Không tìm thấy hành khách" });
      }

      const busRoundStatus = await prisma.busRoundStatus.findUnique({
        where: { busId_roundId: { busId, roundId } },
        select: {
          driverConfirmedBy: true,
          checkOutLocked: true,
        },
      });

      if (busRoundStatus?.driverConfirmedBy) {
        return res.status(403).json({
          message:
            "Round has been locked by driver; cannot add more passengers",
        });
      }

      const existing = await prisma.transaction.findUnique({
        where: {
          passengerId_roundId: {
            passengerId,
            roundId,
          },
        },
      });

      if (existing?.checkIn && existing.checkOut) {
        return res.status(409).json({
          code: "PASSENGER_ATTENDANCE_ALREADY_COMPLETED",
          message:
            "Passenger has completed both check-in and check-out and cannot be added again.",
          busId: existing.busId,
        });
      }

      const activeAttendanceConflict = await getActiveAttendanceBusConflict(
        existing?.id,
        busId,
        roundId,
      );

      if (activeAttendanceConflict.blocked) {
        // Chặn trường hợp cùng hành khách đang được điểm danh ở xe khác không hợp lệ.
        return res.status(409).json({
          code: activeAttendanceConflict.code,
          message: activeAttendanceConflict.message,
          busId: activeAttendanceConflict.busId,
        });
      }

      if (activeAttendanceConflict.allowTransferForCheckOut) {
        // Cho phép chuyển bus khi hành khách cần check-out ở xe khác và xe đích chưa khóa.
        const targetBusRoundStatus = await getTargetBusRoundCompletion(
          busId,
          roundId,
        );

        if (targetBusRoundStatus?.driverConfirmedBy) {
          return res.status(403).json({
            code: "TARGET_BUS_ROUND_COMPLETED",
            message:
              "Target bus has completed this round and cannot receive extra passengers.",
          });
        }

        if (targetBusRoundStatus?.checkOutLocked) {
          return res.status(403).json({
            code: "TARGET_BUS_CHECK_OUT_LOCKED",
            message:
              "Target bus check-out is locked and cannot receive extra passengers.",
          });
        }

        const updatedForCheckOut = await prisma.transaction.update({
          where: { id: existing!.id },
          data: { busId },
        });

        return res.status(200).json(updatedForCheckOut);
      }

      if (existing?.checkIn || existing?.checkOut) {
        return res.status(200).json(existing);
      }

      const transaction = existing
        // Nếu đã có transaction passenger-round thì cập nhật xe, không tạo bản ghi trùng.
        ? await prisma.transaction.update({
            where: { id: existing.id },
            data: {
              busId,
              checkIn: false,
              checkOut: false,
              checkInNote: null,
              checkOutNote: null,
            },
          })
        : await prisma.transaction.create({
            data: {
              busId,
              roundId,
              passengerId,
              checkIn: false,
              checkOut: false,
              checkInNote: null,
              checkOutNote: null,
            },
          });

      res.status(existing ? 200 : 201).json(transaction);
    } catch (error: any) {
      res.status(500).json({ message: "Lỗi hệ thống", detail: error?.message });
    }
  },

  delete: async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = ensureTenant(req, res);
      if (!tenantId) return;

      if (!canMutateTransactions(req)) {
        return res.status(403).json({ message: "Từ chối truy cập (Forbidden)" });
      }

      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "ID giao dịch không hợp lệ" });
      }

      const existing = await prisma.transaction.findFirst({
        where: {
          id,
          bus: {
            trip: { tenantId },
          },
        },
        include: {
          _count: {
            select: {
              events: true,
            },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ message: "Không tìm thấy giao dịch" });
      }

      if (existing.checkIn || existing.checkOut) {
        return res.status(409).json({
          code: "TRANSACTION_HAS_ACTIVE_ATTENDANCE",
          message:
            "Không thể xóa khách đang có trạng thái điểm danh. Hãy bỏ tick điểm danh trước khi xóa khỏi bảng.",
        });
      }

      await prisma.transaction.delete({ where: { id } });
      res.json({ message: "Đã xóa thành công" });
    } catch (error: any) {
      res.status(500).json({ message: "Lỗi hệ thống", detail: error?.message });
    }
  },
};
