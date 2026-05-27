import { workerData, parentPort } from 'node:worker_threads';
import mqtt from 'mqtt';
import fs from 'node:fs';
import { type AppConfig } from './types.js';
import pkg from 'pg';

const { Pool } = pkg;

async function init() {
    let config: AppConfig;

    try {
        const rawConfig = fs.readFileSync(workerData.configPath, 'utf8');
        config = JSON.parse(rawConfig);
    } catch (e: any) {
        parentPort?.postMessage(` Lỗi cấu hình: ${e.message}`);
        return;
    }

    const prj = config.project_name;

    const pool = new Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        user: config.postgres.user,
        password: config.postgres.password,
        database: config.postgres.database,
    });

    const client = mqtt.connect(
        `${config.mqtt.protocol}://${config.mqtt.host}:${config.mqtt.port}`,
        {
            username: config.mqtt.username,
            password: config.mqtt.password,
            clientId: `worker_${prj}_${Math.random().toString(16).slice(3)}`,
            clean: true,
        }
    );

    const uiTopicPrefix =
        config.mqtt.uiTopicPrefix || 'attendance/ui/trip';

    const readTrimmedNote = (
        value: any
    ): string | null | undefined => {
        if (value === undefined) return undefined;
        if (value === null) return null;

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
                    ? { checkInNote: checkInNote ?? null }
                    : {}),
                ...(hasExplicitCheckOutNote
                    ? { checkOutNote: checkOutNote ?? null }
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

    const createNotification = async (
        userId: number,
        type: string,
        title: string,
        content: string,
        payload: Record<string, unknown>
    ) => {
        if (!Number.isInteger(userId) || userId <= 0) {
            return;
        }

        const exists = await pool.query(
            `
            SELECT id
            FROM "Notification"
            WHERE "userId" = $1
              AND type = $2
              AND (payload->>'transactionId')::int = $3
              AND (payload->>'passengerId')::int = $4
              AND payload->>'eventType' = $5
            ORDER BY "createdAt" DESC, id DESC
            LIMIT 1
            `,
            [
                userId,
                type,
                Number(payload.transactionId || 0),
                Number(payload.passengerId || 0),
                String(payload.eventType || ''),
            ]
        );

        if (exists.rows.length > 0) {
            return;
        }

        await pool.query(
            `
            INSERT INTO "Notification"
            (
                "userId",
                type,
                title,
                content,
                payload,
                "isRead",
                "createdAt"
            )
            VALUES ($1, $2, $3, $4, $5, false, NOW())
            `,
            [
                userId,
                type,
                title,
                content,
                JSON.stringify(payload),
            ]
        );
    };

    client.on('connect', () => {
        parentPort?.postMessage(`[${prj}] Connected.`);
        client.subscribe(config.mqtt.topic);
    });

    const handleAttendanceMessage = async (
        _topic: string,
        data: any
    ) => {
        try {
            

            if (
                !data.passengerId ||
                !data.roundId ||
                !data.busId
            ) {
                throw new Error(
                    'Dữ liệu thiếu passengerId, roundId hoặc busId'
                );
            }

            const eventAt = new Date();

            const incomingCheckInNote =
                readTrimmedNote(data.checkInNote);

            const incomingCheckOutNote =
                readTrimmedNote(data.checkOutNote);

            const incomingLegacyNote =
                readTrimmedNote(data.note);

            const resolvedNotes = resolveTransactionNotes({
                checkIn: Boolean(data.checkIn),
                checkOut: Boolean(data.checkOut),
                checkInNote: incomingCheckInNote,
                checkOutNote: incomingCheckOutNote,
                legacyNote: incomingLegacyNote,
            });

            const parseOperatorToInt = (val: any) => {
                if (val === undefined || val === null) {
                    return null;
                }

                const n = Number(val);

                return Number.isInteger(n) ? n : null;
            };

            const candidateIn =
                data.checkInBy ??
                data.user ??
                data.operator;

            const candidateOut =
                data.checkOutBy ??
                data.user ??
                data.operator;

            const checkInBy = data.checkIn
                ? parseOperatorToInt(candidateIn)
                : null;

            const checkOutBy = data.checkOut
                ? parseOperatorToInt(candidateOut)
                : null;

            const existingRes = await pool.query(
                `
                SELECT *
                FROM "Transaction"
                WHERE "passengerId" = $1
                  AND "roundId" = $2
                `,
                [data.passengerId, data.roundId]
            );

            const existing = existingRes.rows[0];

            const isNewTransaction = !existing;

            const checkInStatusChanged =
                isNewTransaction
                    ? Boolean(data.checkIn)
                    : Boolean(existing.checkIn) !==
                      Boolean(data.checkIn);

            const checkOutStatusChanged =
                isNewTransaction
                    ? Boolean(data.checkOut)
                    : Boolean(existing.checkOut) !==
                      Boolean(data.checkOut);

            const hasAttendanceStatusChanged =
                checkInStatusChanged ||
                checkOutStatusChanged;

            let eventType: string | null = null;

            if (checkInStatusChanged) {
                eventType = Boolean(data.checkIn)
                    ? 'CHECK_IN_ON'
                    : 'CHECK_IN_OFF';
            }

            if (checkOutStatusChanged) {
                eventType = Boolean(data.checkOut)
                    ? 'CHECK_OUT_ON'
                    : 'CHECK_OUT_OFF';
            }

            let result: any = null;

            if (existing) {
                const updateRes = await pool.query(
                    `
                    UPDATE "Transaction"
                    SET
                        "busId" = $1,
                        "checkIn" = $2,
                        "checkOut" = $3,
                        "checkInNote" = $4,
                        "checkOutNote" = $5
                    WHERE id = $6
                    RETURNING *
                    `,
                    [
                        data.busId,
                        Boolean(data.checkIn),
                        Boolean(data.checkOut),
                        resolvedNotes.checkInNote ??
                            existing.checkInNote ??
                            null,
                        resolvedNotes.checkOutNote ??
                            existing.checkOutNote ??
                            null,
                        existing.id,
                    ]
                );

                result = updateRes.rows[0];
            } else {
                const insertRes = await pool.query(
                    `
                    INSERT INTO "Transaction"
                    (
                        "passengerId",
                        "roundId",
                        "busId",
                        "checkIn",
                        "checkOut",
                        "checkInNote",
                        "checkOutNote"
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    RETURNING *
                    `,
                    [
                        data.passengerId,
                        data.roundId,
                        data.busId,
                        Boolean(data.checkIn),
                        Boolean(data.checkOut),
                        resolvedNotes.checkInNote ??
                            null,
                        resolvedNotes.checkOutNote ??
                            null,
                    ]
                );

                result = insertRes.rows[0];
            }

            if (!result) {
                return;
            }

            const busRes = await pool.query(
                `
                SELECT
                    b.id,
                    b."busCode",
                    b."registrationNumber",
                    b."managerId",
                    t.id as "tripId"
                FROM "Bus" b
                LEFT JOIN "Trip" t
                    ON b."tripId" = t.id
                WHERE b.id = $1
                `,
                [result.busId]
            );

            const busInfo = busRes.rows[0] || null;

            const tripId = busInfo?.tripId ?? null;

            if (!tripId) {
                return;
            }

            const passengerRes = await pool.query(
                `
                SELECT
                    p.id,
                    p.name,
                    p."busId",
                    b."busCode",
                    b."registrationNumber",
                    b."managerId"
                FROM "Passenger" p
                JOIN "Bus" b
                    ON b.id = p."busId"
                WHERE p.id = $1
                `,
                [result.passengerId]
            );

            const passengerInfo =
                passengerRes.rows[0] || null;

            const roundRes = await pool.query(
                `
                SELECT id, name
                FROM "Round"
                WHERE id = $1
                `,
                [result.roundId]
            );

            const roundInfo = roundRes.rows[0] || null;

            const resolveEventBusIdByActor =
                async (
                    actorId: number | null,
                    fallbackBusId: number
                ) => {
                    if (!actorId || !tripId) {
                        return fallbackBusId;
                    }

                    const actorBusRes =
                        await pool.query(
                            `
                            SELECT id
                            FROM "Bus"
                            WHERE "tripId" = $1
                              AND "managerId" = $2
                            ORDER BY id ASC
                            LIMIT 1
                            `,
                            [tripId, actorId]
                        );

                    return (
                        actorBusRes.rows[0]?.id ??
                        fallbackBusId
                    );
                };

            
            const eventCheckInBusId =
                await resolveEventBusIdByActor(
                    checkInBy,
                    data.busId
                );

            const eventCheckOutBusId =
                await resolveEventBusIdByActor(
                    checkOutBy,
                    data.busId
                );

            const checkInBusRes = await pool.query(
                `
                SELECT "busCode"
                FROM "Bus"
                WHERE id = $1
                `,
                [eventCheckInBusId]
            );

            const checkOutBusRes = await pool.query(
                `
                SELECT "busCode"
                FROM "Bus"
                WHERE id = $1
                `,
                [eventCheckOutBusId]
            );

            const checkInBusCode =
                checkInBusRes.rows[0]?.busCode ||
                eventCheckInBusId;

            const checkOutBusCode =
                checkOutBusRes.rows[0]?.busCode ||
                eventCheckOutBusId;

            const autoCheckInNote =
                passengerInfo &&
                Number(passengerInfo.busId) !==
                    Number(eventCheckInBusId)
                    ? `Khách đang ở trên xe ${checkInBusCode}`
                    : null;

            const autoCheckOutNote =
                passengerInfo &&
                Number(passengerInfo.busId) !==
                    Number(eventCheckOutBusId)
                    ? `Khách đang ở trên xe ${checkOutBusCode}`
                    : null;


            /**
             * CHECK IN ON
             */
            if (
                checkInStatusChanged &&
                result.checkIn
            ) {
                await pool.query(
                    `
                    UPDATE "Transaction"
                    SET "checkInNote" = $1
                    WHERE id = $2
                    `,
                    [
                        autoCheckInNote,
                        result.id,
                    ]
                );

                result.checkInNote =
                    autoCheckInNote;

                await pool.query(
                    `
                    INSERT INTO "AttendanceEvent"
                    (
                        "transactionId",
                        action,
                        "actorId",
                        "busId",
                        note,
                        "createdAt"
                    )
                    VALUES ($1,$2,$3,$4,$5,$6)
                    `,
                    [
                        result.id,
                        'CHECK_IN_ON',
                        checkInBy,
                        eventCheckInBusId,
                        autoCheckInNote ?? '',
                        eventAt,
                    ]
                );
            }

            /**
             * CHECK IN OFF
             */
            if (
                checkInStatusChanged &&
                !result.checkIn
            ) {
                await pool.query(
                    `
                    UPDATE "Transaction"
                    SET "checkInNote" = NULL
                    WHERE id = $1
                    `,
                    [result.id]
                );

                result.checkInNote = null;

                await pool.query(
                    `
                    INSERT INTO "AttendanceEvent"
                    (
                        "transactionId",
                        action,
                        "actorId",
                        "busId",
                        note,
                        "createdAt"
                    )
                    VALUES ($1,$2,$3,$4,$5,$6)
                    `,
                    [
                        result.id,
                        'CHECK_IN_OFF',
                        checkInBy,
                        eventCheckInBusId,
                        '',
                        eventAt,
                    ]
                );
            }

            /**
             * CHECK OUT ON
             */
            if (
                checkOutStatusChanged &&
                result.checkOut
            ) {
                await pool.query(
                    `
                    UPDATE "Transaction"
                    SET "checkOutNote" = $1
                    WHERE id = $2
                    `,
                    [
                        autoCheckOutNote,
                        result.id,
                    ]
                );

                result.checkOutNote =
                    autoCheckOutNote;

                await pool.query(
                    `
                    INSERT INTO "AttendanceEvent"
                    (
                        "transactionId",
                        action,
                        "actorId",
                        "busId",
                        note,
                        "createdAt"
                    )
                    VALUES ($1,$2,$3,$4,$5,$6)
                    `,
                    [
                        result.id,
                        'CHECK_OUT_ON',
                        checkOutBy,
                        eventCheckOutBusId,
                        autoCheckOutNote ?? '',
                        eventAt,
                    ]
                );
            }

            /**
             * CHECK OUT OFF
             */
            if (
                checkOutStatusChanged &&
                !result.checkOut
            ) {
                await pool.query(
                    `
                    UPDATE "Transaction"
                    SET "checkOutNote" = NULL
                    WHERE id = $1
                    `,
                    [result.id]
                );

                result.checkOutNote = null;

                await pool.query(
                    `
                    INSERT INTO "AttendanceEvent"
                    (
                        "transactionId",
                        action,
                        "actorId",
                        "busId",
                        note,
                        "createdAt"
                    )
                    VALUES ($1,$2,$3,$4,$5,$6)
                    `,
                    [
                        result.id,
                        'CHECK_OUT_OFF',
                        checkOutBy,
                        eventCheckOutBusId,
                        '',
                        eventAt,
                    ]
                );
            }

            const checkInEventRes = await pool.query(
                `
                SELECT
                    id,
                    "actorId",
                    "createdAt",
                    "busId"
                FROM "AttendanceEvent"
                WHERE "transactionId" = $1
                  AND action IN
                  (
                    'CHECK_IN_ON',
                    'CHECK_IN_OFF'
                  )
                ORDER BY "createdAt" DESC, id DESC
                LIMIT 1
                `,
                [result.id]
            );

            const checkOutEventRes = await pool.query(
                `
                SELECT
                    id,
                    "actorId",
                    "createdAt",
                    "busId"
                FROM "AttendanceEvent"
                WHERE "transactionId" = $1
                  AND action IN
                  (
                    'CHECK_OUT_ON',
                    'CHECK_OUT_OFF'
                  )
                ORDER BY "createdAt" DESC, id DESC
                LIMIT 1
                `,
                [result.id]
            );

            const checkInEvent =
                checkInEventRes.rows[0] || null;

            const checkOutEvent =
                checkOutEventRes.rows[0] || null;

            let latestEventBusId = result.busId;

            if (
                checkInEvent?.createdAt &&
                checkOutEvent?.createdAt
            ) {
                latestEventBusId =
                    new Date(
                        checkOutEvent.createdAt
                    ).getTime() >
                    new Date(
                        checkInEvent.createdAt
                    ).getTime()
                        ? checkOutEvent.busId
                        : checkInEvent.busId;
            } else if (checkOutEvent?.busId) {
                latestEventBusId =
                    checkOutEvent.busId;
            } else if (checkInEvent?.busId) {
                latestEventBusId =
                    checkInEvent.busId;
            }

            const actualBusRes = await pool.query(
                `
                SELECT
                    b.id,
                    b."busCode",
                    b."registrationNumber",
                    b."managerId",
                    u.name as "managerName"
                FROM "Bus" b
                LEFT JOIN "User" u
                    ON u.id = b."managerId"
                WHERE b.id = $1
                `,
                [latestEventBusId]
            );

            const actualBus =
                actualBusRes.rows[0] || null;

            const isMisassigned =
                passengerInfo &&
                Number(passengerInfo.busId) !==
                    Number(latestEventBusId);


            const assignedManagerId =
                passengerInfo?.managerId ?? null;

            const isWrongBus = Boolean(isMisassigned);

            const targetManagerId =
                assignedManagerId;

            if (
                hasAttendanceStatusChanged &&
                isWrongBus &&
                targetManagerId
            ) {
                const content = `Khách ${
                    passengerInfo?.name ||
                    `#${result.passengerId}`
                } của xe ${
                    passengerInfo?.busCode ||
                    passengerInfo?.busId
                } vừa được điểm danh trên xe ${
                    actualBus?.busCode ||
                    latestEventBusId
                } ở chặng ${
                    roundInfo?.name ||
                    result.roundId
                }.`;

                await createNotification(
                    targetManagerId,
                    'attendance.wrong_bus',
                    'Khách sai xe',
                    content,
                    {
                        tripId,
                        busId: latestEventBusId,
                        roundId: result.roundId,
                        passengerId:
                            result.passengerId,
                        transactionId: result.id,
                        targetManagerId,
                        checkIn: result.checkIn,
                        checkOut: result.checkOut,
                        checkInBy:
                            checkInEvent?.actorId ||
                            null,
                        checkOutBy:
                            checkOutEvent?.actorId ||
                            null,
                        eventType,
                    }
                );
            }
                 
            const basePayload: any = {
                project: prj,
                tripId,
                roundId: result.roundId,
                roundName: roundInfo?.name,
                busId: latestEventBusId,
                passengerId: result.passengerId,
                passengerBusId:
                    passengerInfo?.busId,
                passengerBusManagerId:
                    passengerInfo?.managerId,
                checkIn: result.checkIn,
                checkInAt:
                    checkInEvent?.createdAt ||
                    null,
                checkInBy:
                    checkInEvent?.actorId ||
                    null,
                checkOut: result.checkOut,
                checkOutAt:
                    checkOutEvent?.createdAt ||
                    null,
                checkOutBy:
                    checkOutEvent?.actorId ||
                    null,
                targetManagerId,
                isWrongBus,
                eventType,
            };

            if (hasAttendanceStatusChanged) {
                client.publish(
                    `${uiTopicPrefix}/${tripId}`,
                    JSON.stringify({
                        type: isWrongBus
                            ? 'attendance.wrong_bus'
                            : 'attendance.updated',
                        ...basePayload,
                    }),
                    {
                        qos: 1,
                    }
                );
            }

            if (
                process.env.NODE_ENV ===
                'development'
            ) {
            }
        } catch (e: any) {
            parentPort?.postMessage(
                ` [${prj}] Attendance Error: ${e.message}`
            );
        }
    };

    client.on(
        'message',
        async (topic, msg) => {
            try {
                const data = JSON.parse(
                    msg.toString()
                );

                await handleAttendanceMessage(
                    topic,
                    data
                );
            } catch (e: any) {
                parentPort?.postMessage(
                    ` Parse error: ${e.message}`
                );
            }
        }
    );

    setInterval(async () => {
        const total = pool.totalCount;
        const idle = pool.idleCount;

        if (total > 0) {
            parentPort?.postMessage(
                ` [${prj}] DB Pool Status: Total ${total}, Idle ${idle}`
            );
        }
    }, 60000);
}

init().catch((err) =>
    parentPort?.postMessage(
        `🔥 Fatal: ${err.message}`
    )
);