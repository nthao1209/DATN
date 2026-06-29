"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionController = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../config/db");
const ensureTenant = (req, res) => {
    if (!req.tenantId) {
        res.status(401).json({ message: "Unauthorized" });
        return null;
    }
    return req.tenantId;
};
const canAccessTransactions = (req) => req.roleId === 1 || req.roleId === 2 || req.roleId === 3;
const parseBoolean = (value) => {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number")
        return value === 1;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true")
            return true;
        if (normalized === "false")
            return false;
    }
    return false;
};
const readTrimmedString = (value) => {
    if (value === undefined || value === null)
        return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
};
const hasAttendanceMutationInput = (body) => parseBoolean(body?.checkIn) ||
    parseBoolean(body?.checkOut) ||
    Boolean(readTrimmedString(body?.checkInNote)) ||
    Boolean(readTrimmedString(body?.checkOutNote)) ||
    Boolean(readTrimmedString(body?.note)) ||
    Boolean(body?.checkInAt) ||
    Boolean(body?.checkOutAt);
const getBusDisplayName = async (busId) => {
    const bus = await db_1.prisma.bus.findUnique({
        where: { id: busId },
        select: { busCode: true, registrationNumber: true },
    });
    return bus?.busCode || bus?.registrationNumber || `xe ${busId}`;
};
const getActiveAttendanceBusConflict = async (transactionId, targetBusId, roundId) => {
    if (!transactionId) {
        return {
            blocked: false,
            allowTransferForCheckOut: false,
        };
    }
    const [latestAttendanceEvent, latestCheckInEvent, latestCheckOutEvent] = await Promise.all([
        db_1.prisma.attendanceEvent.findFirst({
            where: {
                transactionId,
                action: {
                    in: [
                        client_1.AttendanceAction.CHECK_IN_ON,
                        client_1.AttendanceAction.CHECK_IN_OFF,
                        client_1.AttendanceAction.CHECK_OUT_ON,
                        client_1.AttendanceAction.CHECK_OUT_OFF,
                    ],
                },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { action: true, busId: true },
        }),
        db_1.prisma.attendanceEvent.findFirst({
            where: {
                transactionId,
                action: {
                    in: [
                        client_1.AttendanceAction.CHECK_IN_ON,
                        client_1.AttendanceAction.CHECK_IN_OFF,
                    ],
                },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { action: true, busId: true },
        }),
        db_1.prisma.attendanceEvent.findFirst({
            where: {
                transactionId,
                action: {
                    in: [
                        client_1.AttendanceAction.CHECK_OUT_ON,
                        client_1.AttendanceAction.CHECK_OUT_OFF,
                    ],
                },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { action: true, busId: true },
        }),
    ]);
    if (!latestAttendanceEvent ||
        Number(latestAttendanceEvent.busId) === Number(targetBusId)) {
        return {
            blocked: false,
            allowTransferForCheckOut: false,
        };
    }
    const isCurrentlyCheckedInElsewhere = latestCheckInEvent?.action === client_1.AttendanceAction.CHECK_IN_ON &&
        Number(latestCheckInEvent.busId) !== Number(targetBusId);
    const isAlreadyCheckedOutElsewhere = latestCheckOutEvent?.action === client_1.AttendanceAction.CHECK_OUT_ON &&
        Number(latestCheckOutEvent.busId) !== Number(targetBusId);
    if (isAlreadyCheckedOutElsewhere) {
        return {
            blocked: true,
            code: "PASSENGER_ALREADY_CHECKED_OUT_ON_ANOTHER_BUS",
            busId: Number(latestCheckOutEvent.busId),
            busName: await getBusDisplayName(Number(latestCheckOutEvent.busId)),
            message: `Passenger is already checked out on ${await getBusDisplayName(Number(latestCheckOutEvent.busId))}.`,
        };
    }
    if (!isCurrentlyCheckedInElsewhere || !latestCheckInEvent?.busId) {
        return {
            blocked: false,
            allowTransferForCheckOut: false,
        };
    }
    const sourceBusRoundStatus = await db_1.prisma.busRoundStatus.findUnique({
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
        message: `Passenger is already checked in on ${await getBusDisplayName(Number(latestCheckInEvent.busId))}. Lock check-in on that bus before adding this passenger to another bus for check-out.`,
    };
};
const getTargetBusRoundCompletion = async (busId, roundId) => db_1.prisma.busRoundStatus.findUnique({
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
exports.transactionController = {
    getAll: async (req, res) => {
        try {
            const tenantId = ensureTenant(req, res);
            if (!tenantId)
                return;
            if (!canAccessTransactions(req)) {
                return res.status(403).json({ message: "Forbidden" });
            }
            const managerCondition = req.roleId === 3 && req.user?.id
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
            const transactions = await db_1.prisma.transaction.findMany({
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
        }
        catch (error) {
            res.status(500).json({ message: "Server error", detail: error?.message });
        }
    },
    create: async (req, res) => {
        try {
            const tenantId = ensureTenant(req, res);
            if (!tenantId)
                return;
            if (!canAccessTransactions(req)) {
                return res.status(403).json({ message: "Forbidden" });
            }
            if (hasAttendanceMutationInput(req.body)) {
                return res.status(400).json({
                    code: "ATTENDANCE_MUST_USE_MQTT",
                    message: "Attendance changes must be synced through MQTT worker. This endpoint only adds a passenger placeholder to the attendance table.",
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
            const bus = await db_1.prisma.bus.findFirst({
                where: { id: busId, trip: { tenantId } },
                select: { id: true, tripId: true },
            });
            if (!bus) {
                return res.status(404).json({ message: "Bus not found" });
            }
            const round = await db_1.prisma.round.findFirst({
                where: { id: roundId, trip: { tenantId } },
                select: { id: true, tripId: true },
            });
            if (!round) {
                return res.status(404).json({ message: "Round not found" });
            }
            if (Number(round.tripId) !== Number(bus.tripId)) {
                return res
                    .status(400)
                    .json({ message: "Round does not belong to the selected bus trip" });
            }
            const passenger = await db_1.prisma.passenger.findFirst({
                where: {
                    id: passengerId,
                    bus: { trip: { tenantId } },
                },
                select: { id: true },
            });
            if (!passenger) {
                return res.status(404).json({ message: "Passenger not found" });
            }
            const busRoundStatus = await db_1.prisma.busRoundStatus.findUnique({
                where: { busId_roundId: { busId, roundId } },
                select: {
                    driverConfirmedBy: true,
                    checkOutLocked: true,
                },
            });
            if (busRoundStatus?.driverConfirmedBy) {
                return res.status(403).json({
                    message: "Round has been locked by driver; cannot add more passengers",
                });
            }
            const existing = await db_1.prisma.transaction.findUnique({
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
                    message: "Passenger has completed both check-in and check-out and cannot be added again.",
                    busId: existing.busId,
                });
            }
            const activeAttendanceConflict = await getActiveAttendanceBusConflict(existing?.id, busId, roundId);
            if (activeAttendanceConflict.blocked) {
                return res.status(409).json({
                    code: activeAttendanceConflict.code,
                    message: activeAttendanceConflict.message,
                    busId: activeAttendanceConflict.busId,
                });
            }
            if (activeAttendanceConflict.allowTransferForCheckOut) {
                const targetBusRoundStatus = await getTargetBusRoundCompletion(busId, roundId);
                if (targetBusRoundStatus?.driverConfirmedBy) {
                    return res.status(403).json({
                        code: "TARGET_BUS_ROUND_COMPLETED",
                        message: "Target bus has completed this round and cannot receive extra passengers.",
                    });
                }
                if (targetBusRoundStatus?.checkOutLocked) {
                    return res.status(403).json({
                        code: "TARGET_BUS_CHECK_OUT_LOCKED",
                        message: "Target bus check-out is locked and cannot receive extra passengers.",
                    });
                }
                const updatedForCheckOut = await db_1.prisma.transaction.update({
                    where: { id: existing.id },
                    data: { busId },
                });
                return res.status(200).json(updatedForCheckOut);
            }
            if (existing?.checkIn || existing?.checkOut) {
                return res.status(200).json(existing);
            }
            const transaction = existing
                ? await db_1.prisma.transaction.update({
                    where: { id: existing.id },
                    data: {
                        busId,
                        checkIn: false,
                        checkOut: false,
                        checkInNote: null,
                        checkOutNote: null,
                    },
                })
                : await db_1.prisma.transaction.create({
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
        }
        catch (error) {
            res.status(500).json({ message: "Server error", detail: error?.message });
        }
    },
    delete: async (req, res) => {
        try {
            const tenantId = ensureTenant(req, res);
            if (!tenantId)
                return;
            if (!canAccessTransactions(req)) {
                return res.status(403).json({ message: "Forbidden" });
            }
            const id = Number(req.params.id);
            if (!id) {
                return res.status(400).json({ message: "Invalid transaction id" });
            }
            const existing = await db_1.prisma.transaction.findFirst({
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
                return res.status(404).json({ message: "Transaction not found" });
            }
            if (existing.checkIn || existing.checkOut) {
                return res.status(409).json({
                    code: "TRANSACTION_HAS_ACTIVE_ATTENDANCE",
                    message: "Không thể xóa khách đang có trạng thái điểm danh. Hãy bỏ tick điểm danh trước khi xóa khỏi bảng.",
                });
            }
            await db_1.prisma.transaction.delete({ where: { id } });
            res.json({ message: "Deleted successfully" });
        }
        catch (error) {
            res.status(500).json({ message: "Server error", detail: error?.message });
        }
    },
};
