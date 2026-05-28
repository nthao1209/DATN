import { AttendanceAction } from '@prisma/client';
import type { MqttClient } from 'mqtt';
import { prisma } from '../config/db';
import { createNotification } from './notificationService';
import { getMqttClient, publishToTripTopic } from './mqtt';

type AttendanceMqttPayload = {
  passengerId?: number | string;
  roundId?: number | string;
  busId?: number | string;
  checkIn?: unknown;
  checkOut?: unknown;
  checkInBy?: number | string | null;
  checkOutBy?: number | string | null;
  user?: number | string | null;
  operator?: number | string | null;
  checkInNote?: string | null;
  checkOutNote?: string | null;
  note?: string | null;
  timestamp?: string;
};

type AttendanceDbClient = Pick<typeof prisma, 'busRoundStatus'>;

const ATTENDANCE_TOPIC = 'attendance/+/+/+/check';
const ATTENDANCE_TOPIC_REGEX =
  /^attendance\/[^/]+\/[^/]+\/[^/]+\/check$/;

const startedClients = new Set<MqttClient>();

const activeClients = new Map<
  MqttClient,
  {
    handleConnect: () => void;
    handleMessage: (
      topic: string,
      payload: Buffer,
    ) => void;
  }
>();

const parseInteger = (
  value: unknown,
): number | null => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed)
    ? parsed
    : null;
};

const parseBoolean = (
  value: unknown,
): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized =
      value.trim().toLowerCase();

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

const readTrimmedNote = (
  value: unknown,
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = String(value).trim();

  return trimmed ? trimmed : null;
};

const resolveTransactionNotes = ({
  checkIn,
  checkOut,
  checkInNote,
  checkOutNote,
  legacyNote,
}: {
  checkIn: boolean;
  checkOut: boolean;
  checkInNote?: string | null | undefined;
  checkOutNote?: string | null | undefined;
  legacyNote?: string | null | undefined;
}) => {
  const hasExplicitCheckInNote =
    checkInNote !== undefined;

  const hasExplicitCheckOutNote =
    checkOutNote !== undefined;

  if (
    hasExplicitCheckInNote ||
    hasExplicitCheckOutNote
  ) {
    return {
      ...(hasExplicitCheckInNote
        ? {
            checkInNote:
              checkInNote ?? null,
          }
        : {}),
      ...(hasExplicitCheckOutNote
        ? {
            checkOutNote:
              checkOutNote ?? null,
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

const pickEarlierDate = (
  current?: Date | null,
  incoming?: Date | null,
): Date | null => {
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

const syncBusRoundStatusTimes = async (
  db: AttendanceDbClient,
  busId: number,
  roundId: number,
  checkInAt?: Date | null,
  checkOutAt?: Date | null,
) => {
  if (!checkInAt && !checkOutAt) {
    return;
  }

  const current =
    await db.busRoundStatus.findUnique({
      where: {
        busId_roundId: {
          busId,
          roundId,
        },
      },
    });

  const nextCheckInAt = checkInAt
    ? pickEarlierDate(
        current?.checkInAt,
        checkInAt,
      )
    : null;

  const nextCheckOutAt = checkOutAt
    ? pickEarlierDate(
        current?.checkOutAt,
        checkOutAt,
      )
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

const resolveEventBusIdByActor =
  async (
    actorId: number | null,
    tripId: number,
    tenantId: number,
    fallbackBusId: number,
  ) => {
    if (!actorId) {
      return fallbackBusId;
    }

    const actorBus =
      await prisma.bus.findFirst({
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

const loadBusCode = async (
  busId: number,
): Promise<string | number> => {
  const bus = await prisma.bus.findUnique({
    where: {
      id: busId,
    },
    select: {
      busCode: true,
    },
  });

  return bus?.busCode ?? busId;
};

const handleAttendanceMessage = async (
  topic: string,
  payload: AttendanceMqttPayload,
) => {
  if (
    !ATTENDANCE_TOPIC_REGEX.test(topic)
  ) {
    return;
  }

  const passengerId = parseInteger(
    payload.passengerId,
  );

  const roundId = parseInteger(
    payload.roundId,
  );

  const busId = parseInteger(
    payload.busId,
  );

  if (
    !passengerId ||
    !roundId ||
    !busId
  ) {
    throw new Error(
      'Missing passengerId, roundId or busId',
    );
  }

  const incomingCheckIn = parseBoolean(
    payload.checkIn,
  );

  const incomingCheckOut = parseBoolean(
    payload.checkOut,
  );

  const eventAt = payload.timestamp
    ? new Date(payload.timestamp)
    : new Date();

  const bus = await prisma.bus.findUnique({
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
    throw new Error(
      `Bus not found: ${busId}`,
    );
  }

  const passenger =
    await prisma.passenger.findUnique({
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
    throw new Error(
      `Passenger not found: ${passengerId}`,
    );
  }

  const round =
    await prisma.round.findFirst({
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
    throw new Error(
      `Round not found: ${roundId}`,
    );
  }

  const incomingCheckInNote =
    readTrimmedNote(
      payload.checkInNote,
    );

  const incomingCheckOutNote =
    readTrimmedNote(
      payload.checkOutNote,
    );

  const incomingLegacyNote =
    readTrimmedNote(payload.note);

  const candidateIn =
    payload.checkInBy ??
    payload.user ??
    payload.operator;

  const candidateOut =
    payload.checkOutBy ??
    payload.user ??
    payload.operator;

  const checkInBy = incomingCheckIn
    ? parseInteger(candidateIn)
    : null;

  const checkOutBy = incomingCheckOut
    ? parseInteger(candidateOut)
    : null;

  const eventCheckInBusId =
    await resolveEventBusIdByActor(
      checkInBy,
      bus.tripId,
      bus.trip.tenantId,
      busId,
    );

  const eventCheckOutBusId =
    await resolveEventBusIdByActor(
      checkOutBy,
      bus.tripId,
      bus.trip.tenantId,
      busId,
    );

  const [
    checkInBusCode,
    checkOutBusCode,
  ] = await Promise.all([
    loadBusCode(eventCheckInBusId),
    loadBusCode(eventCheckOutBusId),
  ]);

  let hasAttendanceStatusChanged =
    false;

  const transaction =
    await prisma.$transaction(
      async (tx) => {
        const existing =
          await tx.transaction.findUnique({
            where: {
              passengerId_roundId: {
                passengerId,
                roundId,
              },
            },
          });

        const isNewTransaction =
          !existing;

        const checkInStatusChanged =
          isNewTransaction
            ? incomingCheckIn
            : Boolean(existing.checkIn) !==
              incomingCheckIn;

        const checkOutStatusChanged =
          isNewTransaction
            ? incomingCheckOut
            : Boolean(existing.checkOut) !==
              incomingCheckOut;

        hasAttendanceStatusChanged =
          checkInStatusChanged ||
          checkOutStatusChanged;

        const autoCheckInNote =
          passenger.busId !==
          eventCheckInBusId
            ? `Khách đang ở trên xe ${checkInBusCode}`
            : null;

        const autoCheckOutNote =
          passenger.busId !==
          eventCheckOutBusId
            ? `Khách đang ở trên xe ${checkOutBusCode}`
            : null;

        const resolvedNotes =
          resolveTransactionNotes({
            checkIn: incomingCheckIn,
            checkOut:
              incomingCheckOut,
            checkInNote:
              incomingCheckInNote,
            checkOutNote:
              incomingCheckOutNote,
            legacyNote:
              incomingLegacyNote,
          });

        const nextCheckInNote =
          checkInStatusChanged
            ? incomingCheckIn
              ? incomingCheckInNote ??
                autoCheckInNote
              : null
            : resolvedNotes.checkInNote ??
              existing?.checkInNote;

        const nextCheckOutNote =
          checkOutStatusChanged
            ? incomingCheckOut
              ? incomingCheckOutNote ??
                autoCheckOutNote
              : null
            : resolvedNotes.checkOutNote ??
              existing?.checkOutNote;

        const updated = existing
          ? await tx.transaction.update(
              {
                where: {
                  id: existing.id,
                },
                data: {
                  busId,
                  checkIn:
                    incomingCheckIn,
                  checkOut:
                    incomingCheckOut,
                  lastActionAt:
                    eventAt,
                  ...(nextCheckInNote !==
                  undefined
                    ? {
                        checkInNote:
                          nextCheckInNote,
                      }
                    : {}),
                  ...(nextCheckOutNote !==
                  undefined
                    ? {
                        checkOutNote:
                          nextCheckOutNote,
                      }
                    : {}),
                },
              },
            )
          : await tx.transaction.create(
              {
                data: {
                  busId,
                  roundId,
                  passengerId,
                  checkIn:
                    incomingCheckIn,
                  checkOut:
                    incomingCheckOut,
                  lastActionAt:
                    eventAt,
                  ...(nextCheckInNote !==
                  undefined
                    ? {
                        checkInNote:
                          nextCheckInNote,
                      }
                    : {}),
                  ...(nextCheckOutNote !==
                  undefined
                    ? {
                        checkOutNote:
                          nextCheckOutNote,
                      }
                    : {}),
                },
              },
            );

        if (checkInStatusChanged) {
          await tx.attendanceEvent.create(
            {
              data: {
                transactionId:
                  updated.id,
                action:
                  incomingCheckIn
                    ? AttendanceAction.CHECK_IN_ON
                    : AttendanceAction.CHECK_IN_OFF,
                actorId:
                  checkInBy,
                busId:
                  eventCheckInBusId,
                note:
                  nextCheckInNote ??
                  '',
                createdAt:
                  eventAt,
              },
            },
          );
        }

        if (checkOutStatusChanged) {
          await tx.attendanceEvent.create(
            {
              data: {
                transactionId:
                  updated.id,
                action:
                  incomingCheckOut
                    ? AttendanceAction.CHECK_OUT_ON
                    : AttendanceAction.CHECK_OUT_OFF,
                actorId:
                  checkOutBy,
                busId:
                  eventCheckOutBusId,
                note:
                  nextCheckOutNote ??
                  '',
                createdAt:
                  eventAt,
              },
            },
          );
        }

        await syncBusRoundStatusTimes(
          tx as AttendanceDbClient,
          busId,
          roundId,
          checkInStatusChanged ? eventAt : null,
          checkOutStatusChanged ? eventAt : null,
        );

        // Recompute latestEventBusId from persisted AttendanceEvent rows to
        // avoid transient ordering issues and ensure we reflect the true
        // latest event persisted for this transaction.
        const lastCheckInEvent = await tx.attendanceEvent.findFirst({
          where: {
            transactionId: updated.id,
            action: { in: [AttendanceAction.CHECK_IN_ON, AttendanceAction.CHECK_IN_OFF] },
          },
          orderBy: { createdAt: 'desc' },
        });

        const lastCheckOutEvent = await tx.attendanceEvent.findFirst({
          where: {
            transactionId: updated.id,
            action: { in: [AttendanceAction.CHECK_OUT_ON, AttendanceAction.CHECK_OUT_OFF] },
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
        } else if (lastCheckOutEvent?.busId) {
          latestEventBusId = lastCheckOutEvent.busId;
        } else if (lastCheckInEvent?.busId) {
          latestEventBusId = lastCheckInEvent.busId;
        } else if (checkOutStatusChanged) {
          latestEventBusId = eventCheckOutBusId;
        } else if (checkInStatusChanged) {
          latestEventBusId = eventCheckInBusId;
        }

        const isWrongBus = Number(passenger.busId) !== Number(latestEventBusId);

        const targetManagerId = passenger.bus.managerId ?? null;

        const shouldNotifyWrongBus =
          hasAttendanceStatusChanged &&
          isWrongBus &&
          !!targetManagerId &&
          ((checkInStatusChanged && incomingCheckIn) || (checkOutStatusChanged && incomingCheckOut));

        if (shouldNotifyWrongBus) {
          const content = `Khách ${passenger.name || `#${passengerId}`} của xe ${
            passenger.bus.busCode || passenger.bus.registrationNumber || passenger.busId
          } vừa được điểm danh trên xe ${bus.busCode || latestEventBusId} ở chặng ${
            round.name || roundId
          }.`;

          await createNotification(tx, {
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
      },
    );

  const payloadToPublish = {
    type: transaction.shouldNotifyWrongBus ? 'attendance.wrong_bus' : 'attendance.updated',
    project:
      process.env.PROJECT_NAME ||
      'backend',
    tripId: bus.tripId,
    roundId,
    roundName: round.name,
    busId: transaction.eventBusId,
    passengerId,
    passengerName:
      passenger.name,
    passengerBusId:
      passenger.busId,
    passengerBusCode:
      passenger.bus.busCode,
    passengerBusRegistrationNumber:
      passenger.bus
        .registrationNumber,
    passengerBusManagerId:
      passenger.bus.managerId,
    checkIn: incomingCheckIn,
    checkInBy,
    checkOut: incomingCheckOut,
    checkOutBy,
    targetManagerId:
      transaction.targetManagerId,
    requiresReview:
      transaction.isWrongBus,
    updatedAt:
      eventAt.toISOString(),
  };

  if (
    hasAttendanceStatusChanged
  ) {
    await publishToTripTopic(
      bus.tripId,
      payloadToPublish,
    );
  }
};

export const startAttendanceMqttConsumer =
  () => {
    const client =
      getMqttClient();

    if (
      startedClients.has(client)
    ) {
      return () =>
        stopAttendanceMqttConsumer();
    }

    const handleConnect = () => {
      client.subscribe(
        ATTENDANCE_TOPIC,
        {
          qos: 1,
        },
      );
    };

    const handleMessage = async (
      topic: string,
      payload: Buffer,
    ) => {
      if (
        !ATTENDANCE_TOPIC_REGEX.test(
          topic,
        )
      ) {
        return;
      }

      try {
        const parsed = JSON.parse(
          payload.toString(),
        ) as AttendanceMqttPayload;

        await handleAttendanceMessage(
          topic,
          parsed,
        );
      } catch (error) {
        console.error(
          '[attendance-mqtt] Failed to process message:',
          error,
        );
      }
    };

    startedClients.add(client);

    activeClients.set(client, {
      handleConnect,
      handleMessage,
    });

    client.on(
      'connect',
      handleConnect,
    );

    client.on(
      'message',
      handleMessage,
    );

    if (client.connected) {
      client.subscribe(
        ATTENDANCE_TOPIC,
        {
          qos: 1,
        },
      );
    }

    return () =>
      stopAttendanceMqttConsumer();
  };

export const stopAttendanceMqttConsumer =
  () => {
    const client =
      getMqttClient();

    const handlers =
      activeClients.get(client);

    if (!handlers) {
      return;
    }

    client.off(
      'connect',
      handlers.handleConnect,
    );

    client.off(
      'message',
      handlers.handleMessage,
    );

    if (client.connected) {
      client.unsubscribe(
        ATTENDANCE_TOPIC,
      );
    }

    activeClients.delete(client);

    startedClients.delete(client);
  };