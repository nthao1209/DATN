"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopAttendanceMqttConsumer = exports.startAttendanceMqttConsumer = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../config/db");
const notificationService_1 = require("./notificationService");
const mqtt_1 = require("./mqtt");
const ATTENDANCE_TOPIC = 'attendance/+/+/+/check';
const ATTENDANCE_TOPIC_REGEX = /^attendance\/[^/]+\/[^/]+\/[^/]+\/check$/;
const startedClients = new Set();
const activeClients = new Map();
const parseInteger = (value) => {
    if (value === undefined ||
        value === null ||
        value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed)
        ? parsed
        : null;
};
const parseBoolean = (value) => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {
            return true;
        }
        if (normalized === 'false') {
            return false;
        }
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return false;
};
const readTrimmedNote = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
};
const resolveTransactionNotes = ({ checkIn, checkOut, checkInNote, checkOutNote, legacyNote, }) => {
    const hasExplicitCheckInNote = checkInNote !== undefined;
    const hasExplicitCheckOutNote = checkOutNote !== undefined;
    if (hasExplicitCheckInNote ||
        hasExplicitCheckOutNote) {
        return {
            ...(hasExplicitCheckInNote
                ? {
                    checkInNote: checkInNote ?? null,
                }
                : {}),
            ...(hasExplicitCheckOutNote
                ? {
                    checkOutNote: checkOutNote ?? null,
                }
                : {}),
        };
    }
    if (legacyNote === undefined) {
        return {};
    }
    if (checkIn && !checkOut) {
        return {
            checkInNote: legacyNote ?? null,
        };
    }
    if (checkOut && !checkIn) {
        return {
            checkOutNote: legacyNote ?? null,
        };
    }
    return {
        checkInNote: legacyNote ?? null,
        checkOutNote: legacyNote ?? null,
    };
};
const pickEarlierDate = (current, incoming) => {
    if (!incoming) {
        return current ?? null;
    }
    if (!current) {
        return incoming;
    }
    return current < incoming
        ? current
        : incoming;
};
const syncBusRoundStatusTimes = async (db, busId, roundId, checkInAt, checkOutAt) => {
    if (!checkInAt && !checkOutAt) {
        return;
    }
    const current = await db.busRoundStatus.findUnique({
        where: {
            busId_roundId: {
                busId,
                roundId,
            },
        },
    });
    const nextCheckInAt = checkInAt
        ? pickEarlierDate(current?.checkInAt, checkInAt)
        : null;
    const nextCheckOutAt = checkOutAt
        ? pickEarlierDate(current?.checkOutAt, checkOutAt)
        : null;
    await db.busRoundStatus.upsert({
        where: {
            busId_roundId: {
                busId,
                roundId,
            },
        },
        create: {
            busId,
            roundId,
            checkInLocked: false,
            checkOutLocked: false,
            checkInAt: nextCheckInAt,
            checkOutAt: nextCheckOutAt,
        },
        update: {
            ...(nextCheckInAt
                ? { checkInAt: nextCheckInAt }
                : {}),
            ...(nextCheckOutAt
                ? { checkOutAt: nextCheckOutAt }
                : {}),
        },
    });
};
const resolveEventBusIdByActor = async (actorId, tripId, tenantId, fallbackBusId) => {
    if (!actorId) {
        return fallbackBusId;
    }
    const actorBus = await db_1.prisma.bus.findFirst({
        where: {
            tripId,
            managerId: actorId,
            trip: {
                tenantId,
            },
        },
        select: {
            id: true,
        },
    });
    return actorBus?.id ?? fallbackBusId;
};
const loadBusCode = async (busId) => {
    const bus = await db_1.prisma.bus.findUnique({
        where: {
            id: busId,
        },
        select: {
            busCode: true,
        },
    });
    return bus?.busCode ?? busId;
};
const handleAttendanceMessage = async (topic, payload) => {
    if (!ATTENDANCE_TOPIC_REGEX.test(topic)) {
        return;
    }
    const passengerId = parseInteger(payload.passengerId);
    const roundId = parseInteger(payload.roundId);
    const busId = parseInteger(payload.busId);
    if (!passengerId ||
        !roundId ||
        !busId) {
        throw new Error('Missing passengerId, roundId or busId');
    }
    const incomingCheckIn = parseBoolean(payload.checkIn);
    const incomingCheckOut = parseBoolean(payload.checkOut);
    const eventAt = payload.timestamp
        ? new Date(payload.timestamp)
        : new Date();
    const bus = await db_1.prisma.bus.findUnique({
        where: {
            id: busId,
        },
        select: {
            id: true,
            busCode: true,
            registrationNumber: true,
            managerId: true,
            tripId: true,
            trip: {
                select: {
                    tenantId: true,
                },
            },
        },
    });
    if (!bus) {
        throw new Error(`Bus not found: ${busId}`);
    }
    const passenger = await db_1.prisma.passenger.findUnique({
        where: {
            id: passengerId,
        },
        select: {
            id: true,
            name: true,
            busId: true,
            bus: {
                select: {
                    busCode: true,
                    registrationNumber: true,
                    managerId: true,
                },
            },
        },
    });
    if (!passenger) {
        throw new Error(`Passenger not found: ${passengerId}`);
    }
    const round = await db_1.prisma.round.findFirst({
        where: {
            id: roundId,
            tripId: bus.tripId,
        },
        select: {
            id: true,
            name: true,
        },
    });
    if (!round) {
        throw new Error(`Round not found: ${roundId}`);
    }
    const incomingCheckInNote = readTrimmedNote(payload.checkInNote);
    const incomingCheckOutNote = readTrimmedNote(payload.checkOutNote);
    const incomingLegacyNote = readTrimmedNote(payload.note);
    const candidateIn = payload.checkInBy ??
        payload.user ??
        payload.operator;
    const candidateOut = payload.checkOutBy ??
        payload.user ??
        payload.operator;
    const checkInBy = incomingCheckIn
        ? parseInteger(candidateIn)
        : null;
    const checkOutBy = incomingCheckOut
        ? parseInteger(candidateOut)
        : null;
    const eventCheckInBusId = await resolveEventBusIdByActor(checkInBy, bus.tripId, bus.trip.tenantId, busId);
    const eventCheckOutBusId = await resolveEventBusIdByActor(checkOutBy, bus.tripId, bus.trip.tenantId, busId);
    const [checkInBusCode, checkOutBusCode,] = await Promise.all([
        loadBusCode(eventCheckInBusId),
        loadBusCode(eventCheckOutBusId),
    ]);
    let hasAttendanceStatusChanged = false;
    const transaction = await db_1.prisma.$transaction(async (tx) => {
        const existing = await tx.transaction.findUnique({
            where: {
                passengerId_roundId: {
                    passengerId,
                    roundId,
                },
            },
        });
        const isNewTransaction = !existing;
        const checkInStatusChanged = isNewTransaction
            ? incomingCheckIn
            : Boolean(existing.checkIn) !==
                incomingCheckIn;
        const checkOutStatusChanged = isNewTransaction
            ? incomingCheckOut
            : Boolean(existing.checkOut) !==
                incomingCheckOut;
        hasAttendanceStatusChanged =
            checkInStatusChanged ||
                checkOutStatusChanged;
        const autoCheckInNote = passenger.busId !==
            eventCheckInBusId
            ? `Khách đang ở trên xe ${checkInBusCode}`
            : null;
        const autoCheckOutNote = passenger.busId !==
            eventCheckOutBusId
            ? `Khách đang ở trên xe ${checkOutBusCode}`
            : null;
        const resolvedNotes = resolveTransactionNotes({
            checkIn: incomingCheckIn,
            checkOut: incomingCheckOut,
            checkInNote: incomingCheckInNote,
            checkOutNote: incomingCheckOutNote,
            legacyNote: incomingLegacyNote,
        });
        const nextCheckInNote = checkInStatusChanged
            ? incomingCheckIn
                ? incomingCheckInNote ??
                    autoCheckInNote
                : null
            : resolvedNotes.checkInNote ??
                existing?.checkInNote;
        const nextCheckOutNote = checkOutStatusChanged
            ? incomingCheckOut
                ? incomingCheckOutNote ??
                    autoCheckOutNote
                : null
            : resolvedNotes.checkOutNote ??
                existing?.checkOutNote;
        const updated = existing
            ? await tx.transaction.update({
                where: {
                    id: existing.id,
                },
                data: {
                    busId,
                    checkIn: incomingCheckIn,
                    checkOut: incomingCheckOut,
                    lastActionAt: eventAt,
                    ...(nextCheckInNote !==
                        undefined
                        ? {
                            checkInNote: nextCheckInNote,
                        }
                        : {}),
                    ...(nextCheckOutNote !==
                        undefined
                        ? {
                            checkOutNote: nextCheckOutNote,
                        }
                        : {}),
                },
            })
            : await tx.transaction.create({
                data: {
                    busId,
                    roundId,
                    passengerId,
                    checkIn: incomingCheckIn,
                    checkOut: incomingCheckOut,
                    lastActionAt: eventAt,
                    ...(nextCheckInNote !==
                        undefined
                        ? {
                            checkInNote: nextCheckInNote,
                        }
                        : {}),
                    ...(nextCheckOutNote !==
                        undefined
                        ? {
                            checkOutNote: nextCheckOutNote,
                        }
                        : {}),
                },
            });
        if (checkInStatusChanged) {
            await tx.attendanceEvent.create({
                data: {
                    transactionId: updated.id,
                    action: incomingCheckIn
                        ? client_1.AttendanceAction.CHECK_IN_ON
                        : client_1.AttendanceAction.CHECK_IN_OFF,
                    actorId: checkInBy,
                    busId: eventCheckInBusId,
                    note: nextCheckInNote ??
                        '',
                    createdAt: eventAt,
                },
            });
        }
        if (checkOutStatusChanged) {
            await tx.attendanceEvent.create({
                data: {
                    transactionId: updated.id,
                    action: incomingCheckOut
                        ? client_1.AttendanceAction.CHECK_OUT_ON
                        : client_1.AttendanceAction.CHECK_OUT_OFF,
                    actorId: checkOutBy,
                    busId: eventCheckOutBusId,
                    note: nextCheckOutNote ??
                        '',
                    createdAt: eventAt,
                },
            });
        }
        await syncBusRoundStatusTimes(tx, busId, roundId, checkInStatusChanged ? eventAt : null, checkOutStatusChanged ? eventAt : null);
        // Recompute latestEventBusId from persisted AttendanceEvent rows to
        // avoid transient ordering issues and ensure we reflect the true
        // latest event persisted for this transaction.
        const lastCheckInEvent = await tx.attendanceEvent.findFirst({
            where: {
                transactionId: updated.id,
                action: { in: [client_1.AttendanceAction.CHECK_IN_ON, client_1.AttendanceAction.CHECK_IN_OFF] },
            },
            orderBy: { createdAt: 'desc' },
        });
        const lastCheckOutEvent = await tx.attendanceEvent.findFirst({
            where: {
                transactionId: updated.id,
                action: { in: [client_1.AttendanceAction.CHECK_OUT_ON, client_1.AttendanceAction.CHECK_OUT_OFF] },
            },
            orderBy: { createdAt: 'desc' },
        });
        let latestEventBusId = updated.busId;
        if (lastCheckOutEvent?.createdAt && lastCheckInEvent?.createdAt) {
            latestEventBusId =
                new Date(lastCheckOutEvent.createdAt).getTime() >
                    new Date(lastCheckInEvent.createdAt).getTime()
                    ? lastCheckOutEvent.busId
                    : lastCheckInEvent.busId;
        }
        else if (lastCheckOutEvent?.busId) {
            latestEventBusId = lastCheckOutEvent.busId;
        }
        else if (lastCheckInEvent?.busId) {
            latestEventBusId = lastCheckInEvent.busId;
        }
        else if (checkOutStatusChanged) {
            latestEventBusId = eventCheckOutBusId;
        }
        else if (checkInStatusChanged) {
            latestEventBusId = eventCheckInBusId;
        }
        const isWrongBus = Number(passenger.busId) !== Number(latestEventBusId);
        const targetManagerId = passenger.bus.managerId ?? null;
        const shouldNotifyWrongBus = hasAttendanceStatusChanged &&
            isWrongBus &&
            !!targetManagerId &&
            ((checkInStatusChanged && incomingCheckIn) || (checkOutStatusChanged && incomingCheckOut));
        if (shouldNotifyWrongBus) {
            const content = `Khách ${passenger.name || `#${passengerId}`} của xe ${passenger.bus.busCode || passenger.bus.registrationNumber || passenger.busId} vừa được điểm danh trên xe ${bus.busCode || latestEventBusId} ở chặng ${round.name || roundId}.`;
            await (0, notificationService_1.createNotification)(tx, {
                userId: targetManagerId,
                type: 'attendance.wrong_bus',
                title: 'Khách sai xe',
                content,
                payload: {
                    tripId: bus.tripId,
                    busId: latestEventBusId,
                    roundId,
                    passengerId,
                    transactionId: updated.id,
                    targetManagerId,
                    checkIn: incomingCheckIn,
                    checkOut: incomingCheckOut,
                    checkInBy,
                    checkOutBy,
                },
            });
        }
        return {
            transaction: updated,
            eventBusId: latestEventBusId,
            isWrongBus,
            targetManagerId,
            shouldNotifyWrongBus,
        };
    });
    const payloadToPublish = {
        type: transaction.shouldNotifyWrongBus ? 'attendance.wrong_bus' : 'attendance.updated',
        project: process.env.PROJECT_NAME ||
            'backend',
        tripId: bus.tripId,
        roundId,
        roundName: round.name,
        busId: transaction.eventBusId,
        passengerId,
        passengerName: passenger.name,
        passengerBusId: passenger.busId,
        passengerBusCode: passenger.bus.busCode,
        passengerBusRegistrationNumber: passenger.bus
            .registrationNumber,
        passengerBusManagerId: passenger.bus.managerId,
        checkIn: incomingCheckIn,
        checkInBy,
        checkOut: incomingCheckOut,
        checkOutBy,
        targetManagerId: transaction.targetManagerId,
        requiresReview: transaction.isWrongBus,
        updatedAt: eventAt.toISOString(),
    };
    if (hasAttendanceStatusChanged) {
        try {
            await (0, mqtt_1.publishToTripTopic)(bus.tripId, payloadToPublish);
        }
        finally {
            (0, mqtt_1.clearRetainedTopic)(topic, 1);
        }
    }
};
const startAttendanceMqttConsumer = () => {
    const client = (0, mqtt_1.getMqttClient)();
    if (startedClients.has(client)) {
        return () => (0, exports.stopAttendanceMqttConsumer)();
    }
    const handleConnect = () => {
        client.subscribe(ATTENDANCE_TOPIC, {
            qos: 1,
        });
    };
    const handleMessage = async (topic, payload) => {
        if (!ATTENDANCE_TOPIC_REGEX.test(topic)) {
            return;
        }
        try {
            const parsed = JSON.parse(payload.toString());
            await handleAttendanceMessage(topic, parsed);
        }
        catch (error) {
            console.error('[attendance-mqtt] Failed to process message:', error);
        }
    };
    startedClients.add(client);
    activeClients.set(client, {
        handleConnect,
        handleMessage,
    });
    client.on('connect', handleConnect);
    client.on('message', handleMessage);
    if (client.connected) {
        client.subscribe(ATTENDANCE_TOPIC, {
            qos: 1,
        });
    }
    return () => (0, exports.stopAttendanceMqttConsumer)();
};
exports.startAttendanceMqttConsumer = startAttendanceMqttConsumer;
const stopAttendanceMqttConsumer = () => {
    const client = (0, mqtt_1.getMqttClient)();
    const handlers = activeClients.get(client);
    if (!handlers) {
        return;
    }
    client.off('connect', handlers.handleConnect);
    client.off('message', handlers.handleMessage);
    if (client.connected) {
        client.unsubscribe(ATTENDANCE_TOPIC);
    }
    activeClients.delete(client);
    startedClients.delete(client);
};
exports.stopAttendanceMqttConsumer = stopAttendanceMqttConsumer;
