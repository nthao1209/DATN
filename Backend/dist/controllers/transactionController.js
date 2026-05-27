"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionController = void 0;
const mqtt_1 = require("../services/mqtt");
const client_1 = require("@prisma/client");
const db_1 = require("../config/db");
const pickEarlierDate = (current, incoming) => {
    if (!incoming)
        return current ?? null;
    if (!current)
        return incoming;
    return current < incoming ? current : incoming;
};
const syncBusRoundStatusTimes = async (busId, roundId, checkInAt, checkOutAt) => {
    if (!checkInAt && !checkOutAt)
        return;
    const current = await db_1.prisma.busRoundStatus.findUnique({
        where: { busId_roundId: { busId, roundId } },
    });
    const nextCheckInAt = checkInAt
        ? pickEarlierDate(current?.checkInAt, checkInAt)
        : null;
    const nextCheckOutAt = checkOutAt
        ? pickEarlierDate(current?.checkOutAt, checkOutAt)
        : null;
    await db_1.prisma.busRoundStatus.upsert({
        where: { busId_roundId: { busId, roundId } },
        create: {
            busId,
            roundId,
            checkInLocked: false,
            checkOutLocked: false,
            checkInAt: nextCheckInAt,
            checkOutAt: nextCheckOutAt,
        },
        update: {
            ...(nextCheckInAt ? { checkInAt: nextCheckInAt } : {}),
            ...(nextCheckOutAt ? { checkOutAt: nextCheckOutAt } : {}),
        },
    });
};
const ensureTenant = (req, res) => {
    if (!req.tenantId) {
        res.status(401).json({ message: "Unauthorized" });
        return null;
    }
    return req.tenantId;
};
const canAccessTransactions = (req) => req.roleId === 2 || req.roleId === 3 || req.roleId === 1;
const hasLockedAttendanceChange = (locked, currentValue, incomingValue) => Boolean(locked) &&
    incomingValue !== undefined &&
    incomingValue !== Boolean(currentValue);
const hasLockedAttendanceNoteChange = (locked, currentNote, incomingNote) => Boolean(locked) &&
    incomingNote !== undefined &&
    incomingNote !== (currentNote ?? null);
const readTrimmedNote = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
};
const resolveTransactionNotes = ({ checkIn, checkOut, checkInNote, checkOutNote, legacyNote, }) => {
    const hasExplicitCheckInNote = checkInNote !== undefined;
    const hasExplicitCheckOutNote = checkOutNote !== undefined;
    if (hasExplicitCheckInNote || hasExplicitCheckOutNote) {
        return {
            ...(hasExplicitCheckInNote ? { checkInNote: checkInNote ?? null } : {}),
            ...(hasExplicitCheckOutNote
                ? { checkOutNote: checkOutNote ?? null }
                : {}),
        };
    }
    if (legacyNote === undefined) {
        return {};
    }
    if (checkIn && !checkOut) {
        return { checkInNote: legacyNote ?? null };
    }
    if (checkOut && !checkIn) {
        return { checkOutNote: legacyNote ?? null };
    }
    return {
        checkInNote: legacyNote ?? null,
        checkOutNote: legacyNote ?? null,
    };
};
const resolveEventBusIdByActor = async (actorId, tripId, tenantId, fallbackBusId) => {
    if (!actorId)
        return fallbackBusId;
    const actorBus = await db_1.prisma.bus.findFirst({
        where: {
            tripId,
            managerId: actorId,
            trip: { tenantId },
        },
        select: { id: true },
    });
    return actorBus?.id ?? fallbackBusId;
};
const publishAttendanceUpdate = async (transactionId) => {
    const transaction = await db_1.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
            passenger: {
                include: {
                    bus: {
                        select: {
                            id: true,
                            busCode: true,
                            registrationNumber: true,
                            tripId: true,
                            managerId: true,
                            trip: {
                                select: { tenantId: true },
                            },
                            manager: {
                                select: { id: true, name: true, email: true },
                            },
                        },
                    },
                },
            },
            bus: {
                select: {
                    id: true,
                    busCode: true,
                    registrationNumber: true,
                    tripId: true,
                    managerId: true,
                    trip: {
                        select: { tenantId: true },
                    },
                    manager: {
                        select: { id: true, name: true, email: true },
                    },
                },
            },
            round: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
    if (!transaction)
        return;
    // Lấy event mới nhất trước
    const events = await db_1.prisma.attendanceEvent.findMany({
        where: { transactionId },
        orderBy: { createdAt: "desc" },
    });
    const checkInEvent = events.find((e) => e.action === client_1.AttendanceAction.CHECK_IN_ON ||
        e.action === client_1.AttendanceAction.CHECK_IN_OFF);
    const checkOutEvent = events.find((e) => e.action === client_1.AttendanceAction.CHECK_OUT_ON ||
        e.action === client_1.AttendanceAction.CHECK_OUT_OFF);
    // ===== XE HIỆN TẠI =====
    // Ưu tiên event mới nhất
    const latestEvent = events[0];
    const latestEventBusId = latestEvent?.busId ??
        checkOutEvent?.busId ??
        checkInEvent?.busId ??
        transaction.busId;
    // Query actual bus theo event mới nhất
    const actualBus = await db_1.prisma.bus.findUnique({
        where: { id: latestEventBusId },
        select: {
            id: true,
            busCode: true,
            registrationNumber: true,
            tripId: true,
            trip: {
                select: {
                    tenantId: true,
                },
            },
            managerId: true,
            manager: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });
    // Avoid fetching user names here to keep payloads compact; frontend can fall back to ids when needed.
    const passengerBus = transaction.passenger.bus;
    // So sánh xe được phân công với xe hiện tại
    const isMisassigned = Number(passengerBus.id) !== Number(latestEventBusId);
    // Manager của xe hiện tại
    const actualManagerId = actualBus?.managerId ?? null;
    // Manager xe được phân công
    const assignedManagerId = passengerBus.managerId ?? null;
    const checkInNeedsReview = Boolean(actualManagerId &&
        checkInEvent?.actorId &&
        Number(checkInEvent.actorId) !== Number(actualManagerId));
    const checkOutNeedsReview = Boolean(actualManagerId &&
        checkOutEvent?.actorId &&
        Number(checkOutEvent.actorId) !== Number(actualManagerId));
    const requiresReview = isMisassigned || checkInNeedsReview || checkOutNeedsReview;
    const targetManagerId = isMisassigned ? assignedManagerId : actualManagerId;
    // keep only manager id as routing key; avoid including manager name to reduce message size
    const payload = {
        project: "backend",
        tripId: actualBus?.tripId ?? transaction.bus.tripId,
        roundId: transaction.roundId,
        roundName: transaction.round?.name,
        // ===== XE HIỆN TẠI =====
        busId: actualBus?.id,
        passengerId: transaction.passengerId,
        passengerName: transaction.passenger.name,
        // ===== XE GỐC CỦA KHÁCH =====
        passengerBusId: passengerBus.id,
        passengerBusRegistrationNumber: passengerBus.registrationNumber,
        passengerBusManagerId: passengerBus.managerId,
        // ===== CHECK IN =====
        checkInBy: checkInEvent?.actorId,
        checkInAt: checkInEvent?.createdAt,
        checkInBusId: checkInEvent?.busId,
        // ===== CHECK OUT =====
        checkOutBy: checkOutEvent?.actorId,
        checkOutAt: checkOutEvent?.createdAt,
        checkOutBusId: checkOutEvent?.busId,
        targetManagerId,
        checkIn: transaction.checkIn,
        checkOut: transaction.checkOut,
        checkInNote: transaction.checkInNote ?? "",
        checkOutNote: transaction.checkOutNote ?? "",
        updatedAt: new Date().toISOString(),
        requiresReview,
    };
    const tenantId = actualBus?.trip?.tenantId ??
        transaction.bus.trip.tenantId ??
        transaction.passenger.bus.trip.tenantId;
    if (tenantId) {
        (0, mqtt_1.publishDashboardRefresh)(tenantId, {
            type: 'dashboard.refresh',
            entity: 'transaction',
            action: 'update',
            tripId: payload.tripId,
            requiresReview,
            updatedAt: payload.updatedAt,
        });
    }
    if (requiresReview) {
        (0, mqtt_1.publishToTripTopic)(payload.tripId, {
            type: "attendance.requires_review",
            ...payload,
        });
        return;
    }
    (0, mqtt_1.publishToTripTopic)(payload.tripId, {
        type: "attendance.updated",
        ...payload,
    });
};
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
                                trip: {
                                    tenantId,
                                },
                            },
                        },
                        {
                            passenger: {
                                bus: {
                                    managerId: req.user.id,
                                    trip: {
                                        tenantId,
                                    },
                                },
                            },
                        },
                    ],
                }
                : {
                    bus: {
                        trip: {
                            tenantId,
                        },
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
                        orderBy: { createdAt: "asc" },
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
            console.error("get transactions error:", error);
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
            });
            if (!bus)
                return res.status(404).json({ message: "Bus not found" });
            const round = await db_1.prisma.round.findFirst({
                where: { id: roundId, trip: { tenantId } },
            });
            if (!round)
                return res.status(404).json({ message: "Round not found" });
            const passenger = await db_1.prisma.passenger.findFirst({
                where: {
                    id: passengerId,
                    bus: {
                        trip: { tenantId },
                    },
                },
            });
            if (!passenger)
                return res.status(404).json({ message: "Passenger not found" });
            const existing = await db_1.prisma.transaction.findUnique({
                where: {
                    passengerId_roundId: {
                        passengerId,
                        roundId,
                    },
                },
            });
            const incomingCheckIn = req.body?.checkIn !== undefined
                ? Boolean(req.body?.checkIn)
                : undefined;
            const incomingCheckOut = req.body?.checkOut !== undefined
                ? Boolean(req.body?.checkOut)
                : undefined;
            const incomingCheckInAt = req.body?.checkInAt
                ? new Date(req.body.checkInAt)
                : undefined;
            const incomingCheckOutAt = req.body?.checkOutAt
                ? new Date(req.body.checkOutAt)
                : undefined;
            const incomingCheckInNote = readTrimmedNote(req.body?.checkInNote);
            const incomingCheckOutNote = readTrimmedNote(req.body?.checkOutNote);
            const incomingLegacyNote = readTrimmedNote(req.body?.note);
            const currentCheckInNote = readTrimmedNote(existing?.checkInNote) ?? null;
            const currentCheckOutNote = readTrimmedNote(existing?.checkOutNote) ?? null;
            let actorId = req.user?.id ?? null;
            console.log(req.user);
            console.log(req.firebaseUser);
            if (!actorId && req.firebaseUser?.uid) {
                try {
                    const possibleUser = await db_1.prisma.user.findUnique({
                        where: { firebaseUid: req.firebaseUser.uid },
                    });
                    if (possibleUser) {
                        actorId = possibleUser.id;
                    }
                }
                catch (e) {
                    console.warn("Fallback user lookup failed", e);
                }
            }
            if (!actorId) {
                console.warn("transaction.create: actorId is null (request may be unauthenticated). req.user:", req.user?.id, "req.firebaseUser:", req.firebaseUser?.uid);
            }
            // Check BusRoundStatus locks
            const brs = await db_1.prisma.busRoundStatus.findUnique({
                where: { busId_roundId: { busId, roundId } },
            });
            if (brs?.driverConfirmedBy) {
                return res
                    .status(403)
                    .json({ message: 'Round has been locked by driver; cannot add more passengers' });
            }
            if (brs) {
                if (hasLockedAttendanceChange(brs.checkInLocked, existing?.checkIn, incomingCheckIn)) {
                    return res
                        .status(403)
                        .json({ message: "Check-in for this bus/round is locked" });
                }
                if (hasLockedAttendanceNoteChange(brs.checkInLocked, currentCheckInNote, incomingCheckInNote)) {
                    return res
                        .status(403)
                        .json({ message: "Check-in note for this bus/round is locked" });
                }
                if (hasLockedAttendanceChange(brs.checkOutLocked, existing?.checkOut, incomingCheckOut)) {
                    return res
                        .status(403)
                        .json({ message: "Check-out for this bus/round is locked" });
                }
                if (hasLockedAttendanceNoteChange(brs.checkOutLocked, currentCheckOutNote, incomingCheckOutNote)) {
                    return res
                        .status(403)
                        .json({ message: "Check-out note for this bus/round is locked" });
                }
            }
            const nextCheckIn = existing
                ? Boolean(existing.checkIn) || Boolean(incomingCheckIn)
                : Boolean(incomingCheckIn);
            const nextCheckOut = existing
                ? Boolean(existing.checkOut) || Boolean(incomingCheckOut)
                : Boolean(incomingCheckOut);
            const now = new Date();
            const eventBusId = await resolveEventBusIdByActor(actorId, Number(round.tripId), tenantId, busId);
            const resolvedNotes = resolveTransactionNotes({
                checkIn: nextCheckIn,
                checkOut: nextCheckOut,
                checkInNote: incomingCheckInNote,
                checkOutNote: incomingCheckOutNote,
                legacyNote: incomingLegacyNote,
            });
            const created = await db_1.prisma.transaction.upsert({
                where: {
                    passengerId_roundId: {
                        passengerId,
                        roundId,
                    },
                },
                update: {
                    busId,
                    checkIn: nextCheckIn,
                    checkOut: nextCheckOut,
                    ...(resolvedNotes.checkInNote !== undefined
                        ? { checkInNote: resolvedNotes.checkInNote }
                        : {}),
                    ...(resolvedNotes.checkOutNote !== undefined
                        ? { checkOutNote: resolvedNotes.checkOutNote }
                        : {}),
                },
                create: {
                    busId: Number(busId),
                    roundId: Number(roundId),
                    passengerId: Number(passengerId),
                    checkIn: nextCheckIn,
                    checkOut: nextCheckOut,
                    ...resolvedNotes,
                },
            });
            // create attendance events only when an action is newly enabled
            const createdEvents = [];
            if (nextCheckIn && !existing?.checkIn) {
                const at = incomingCheckInAt ?? now;
                await db_1.prisma.attendanceEvent.create({
                    data: {
                        transactionId: created.id,
                        action: client_1.AttendanceAction.CHECK_IN_ON,
                        actorId,
                        busId: eventBusId,
                        note: resolvedNotes.checkInNote ?? incomingLegacyNote ?? null,
                        createdAt: at,
                    },
                });
                createdEvents.push({ action: "CHECK_IN", at });
            }
            // create OFF event when action was previously enabled but now disabled
            if (existing?.checkIn && !nextCheckIn) {
                const at = incomingCheckInAt ?? now;
                await db_1.prisma.attendanceEvent.create({
                    data: {
                        transactionId: created.id,
                        action: client_1.AttendanceAction.CHECK_IN_OFF,
                        actorId,
                        busId: eventBusId,
                        note: resolvedNotes.checkInNote ?? incomingLegacyNote ?? null,
                        createdAt: at,
                    },
                });
            }
            if (nextCheckOut && !existing?.checkOut) {
                const at = incomingCheckOutAt ?? now;
                await db_1.prisma.attendanceEvent.create({
                    data: {
                        transactionId: created.id,
                        action: client_1.AttendanceAction.CHECK_OUT_ON,
                        actorId,
                        busId: eventBusId,
                        note: resolvedNotes.checkOutNote ?? incomingLegacyNote ?? null,
                        createdAt: at,
                    },
                });
                createdEvents.push({ action: "CHECK_OUT", at });
            }
            if (existing?.checkOut && !nextCheckOut) {
                const at = incomingCheckOutAt ?? now;
                await db_1.prisma.attendanceEvent.create({
                    data: {
                        transactionId: created.id,
                        action: client_1.AttendanceAction.CHECK_OUT_OFF,
                        actorId,
                        busId: eventBusId,
                        note: resolvedNotes.checkOutNote ?? incomingLegacyNote ?? null,
                        createdAt: at,
                    },
                });
            }
            // sync busRoundStatus using any created event timestamps
            const checkInEventForSync = createdEvents.find((e) => e.action === "CHECK_IN");
            const checkOutEventForSync = createdEvents.find((e) => e.action === "CHECK_OUT");
            await syncBusRoundStatusTimes(busId, roundId, checkInEventForSync ? checkInEventForSync.at : null, checkOutEventForSync ? checkOutEventForSync.at : null);
            if (nextCheckIn || nextCheckOut) {
                await publishAttendanceUpdate(created.id);
            }
            res.status(201).json(created);
        }
        catch (error) {
            console.error("create transaction error:", error);
            res.status(500).json({ message: "Server error", detail: error?.message });
        }
    },
    update: async (req, res) => {
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
                        trip: {
                            tenantId,
                        },
                    },
                },
            });
            if (!existing) {
                return res.status(404).json({ message: "Transaction not found" });
            }
            const checkInInput = req.body?.checkIn;
            const checkOutInput = req.body?.checkOut;
            const incomingCheckInAt = req.body?.checkInAt
                ? new Date(req.body.checkInAt)
                : undefined;
            const incomingCheckOutAt = req.body?.checkOutAt
                ? new Date(req.body.checkOutAt)
                : undefined;
            const incomingCheckInNote = readTrimmedNote(req.body?.checkInNote);
            const incomingCheckOutNote = readTrimmedNote(req.body?.checkOutNote);
            const incomingLegacyNote = readTrimmedNote(req.body?.note);
            const currentCheckInNote = readTrimmedNote(existing.checkInNote) ?? null;
            const currentCheckOutNote = readTrimmedNote(existing.checkOutNote) ?? null;
            let actorId = req.user?.id ?? null;
            if (!actorId && req.firebaseUser?.uid) {
                try {
                    const possibleUser = await db_1.prisma.user.findUnique({
                        where: { firebaseUid: req.firebaseUser.uid },
                    });
                    if (possibleUser)
                        actorId = possibleUser.id;
                }
                catch (e) {
                    console.warn("Fallback user lookup failed", e);
                }
            }
            // enforce BusRoundStatus locks
            const brs = await db_1.prisma.busRoundStatus.findUnique({
                where: {
                    busId_roundId: { busId: existing.busId, roundId: existing.roundId },
                },
            });
            if (brs) {
                if (hasLockedAttendanceChange(brs.checkInLocked, existing.checkIn, checkInInput !== undefined ? Boolean(checkInInput) : undefined)) {
                    return res
                        .status(403)
                        .json({ message: "Check-in for this bus/round is locked" });
                }
                if (hasLockedAttendanceNoteChange(brs.checkInLocked, currentCheckInNote, incomingCheckInNote)) {
                    return res
                        .status(403)
                        .json({ message: "Check-in note for this bus/round is locked" });
                }
                if (hasLockedAttendanceChange(brs.checkOutLocked, existing.checkOut, checkOutInput !== undefined ? Boolean(checkOutInput) : undefined)) {
                    return res
                        .status(403)
                        .json({ message: "Check-out for this bus/round is locked" });
                }
                if (hasLockedAttendanceNoteChange(brs.checkOutLocked, currentCheckOutNote, incomingCheckOutNote)) {
                    return res
                        .status(403)
                        .json({ message: "Check-out note for this bus/round is locked" });
                }
            }
            const nextCheckIn = checkInInput !== undefined ? Boolean(checkInInput) : existing.checkIn;
            const nextCheckOut = checkOutInput !== undefined
                ? Boolean(checkOutInput)
                : existing.checkOut;
            const now = new Date();
            const roundOfExisting = await db_1.prisma.round.findFirst({
                where: { id: existing.roundId, trip: { tenantId } },
                select: { tripId: true },
            });
            if (!roundOfExisting) {
                return res
                    .status(404)
                    .json({ message: "Round not found for transaction" });
            }
            const eventBusId = await resolveEventBusIdByActor(actorId, Number(roundOfExisting.tripId), tenantId, existing.busId);
            const hasAnyNoteInput = incomingCheckInNote !== undefined ||
                incomingCheckOutNote !== undefined ||
                incomingLegacyNote !== undefined;
            const resolvedNotes = resolveTransactionNotes({
                checkIn: nextCheckIn,
                checkOut: nextCheckOut,
                checkInNote: incomingCheckInNote,
                checkOutNote: incomingCheckOutNote,
                legacyNote: incomingLegacyNote,
            });
            const updated = await db_1.prisma.transaction.update({
                where: { id },
                data: {
                    ...(checkInInput !== undefined ? { checkIn: nextCheckIn } : {}),
                    ...(checkOutInput !== undefined ? { checkOut: nextCheckOut } : {}),
                    ...(hasAnyNoteInput && resolvedNotes.checkInNote !== undefined
                        ? { checkInNote: resolvedNotes.checkInNote }
                        : {}),
                    ...(hasAnyNoteInput && resolvedNotes.checkOutNote !== undefined
                        ? { checkOutNote: resolvedNotes.checkOutNote }
                        : {}),
                },
            });
            // create attendance events for newly enabled actions
            const createdEvents = [];
            if (checkInInput !== undefined && nextCheckIn && !existing.checkIn) {
                const at = incomingCheckInAt ?? now;
                await db_1.prisma.attendanceEvent.create({
                    data: {
                        transactionId: updated.id,
                        action: client_1.AttendanceAction.CHECK_IN_ON,
                        actorId,
                        busId: eventBusId,
                        note: resolvedNotes.checkInNote ?? incomingLegacyNote ?? null,
                        createdAt: at,
                    },
                });
                createdEvents.push({ action: "CHECK_IN", at });
            }
            // OFF event for check-in if it was previously true and now false
            if (checkInInput !== undefined && existing.checkIn && !nextCheckIn) {
                const at = incomingCheckInAt ?? now;
                await db_1.prisma.attendanceEvent.create({
                    data: {
                        transactionId: updated.id,
                        action: client_1.AttendanceAction.CHECK_IN_OFF,
                        actorId,
                        busId: eventBusId,
                        note: resolvedNotes.checkInNote ?? incomingLegacyNote ?? null,
                        createdAt: at,
                    },
                });
            }
            if (checkOutInput !== undefined && nextCheckOut && !existing.checkOut) {
                const at = incomingCheckOutAt ?? now;
                await db_1.prisma.attendanceEvent.create({
                    data: {
                        transactionId: updated.id,
                        action: client_1.AttendanceAction.CHECK_OUT_ON,
                        actorId,
                        busId: eventBusId,
                        note: resolvedNotes.checkOutNote ?? incomingLegacyNote ?? null,
                        createdAt: at,
                    },
                });
                createdEvents.push({ action: "CHECK_OUT", at });
            }
            // OFF event for check-out if it was previously true and now false
            if (checkOutInput !== undefined && existing.checkOut && !nextCheckOut) {
                const at = incomingCheckOutAt ?? now;
                await db_1.prisma.attendanceEvent.create({
                    data: {
                        transactionId: updated.id,
                        action: client_1.AttendanceAction.CHECK_OUT_OFF,
                        actorId,
                        busId: eventBusId,
                        note: resolvedNotes.checkOutNote ?? incomingLegacyNote ?? null,
                        createdAt: at,
                    },
                });
            }
            const checkInEventForSync = createdEvents.find((e) => e.action === "CHECK_IN");
            const checkOutEventForSync = createdEvents.find((e) => e.action === "CHECK_OUT");
            await syncBusRoundStatusTimes(existing.busId, existing.roundId, checkInEventForSync ? checkInEventForSync.at : null, checkOutEventForSync ? checkOutEventForSync.at : null);
            if (checkInInput !== undefined || checkOutInput !== undefined) {
                await publishAttendanceUpdate(updated.id);
            }
            res.json(updated);
        }
        catch (error) {
            console.error("update transaction error:", error);
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
                        trip: {
                            tenantId,
                        },
                    },
                },
            });
            if (!existing) {
                return res.status(404).json({ message: "Transaction not found" });
            }
            await db_1.prisma.transaction.delete({ where: { id } });
            res.json({ message: "Deleted successfully" });
        }
        catch (error) {
            console.error("delete transaction error:", error);
            res.status(500).json({ message: "Server error", detail: error?.message });
        }
    },
};
