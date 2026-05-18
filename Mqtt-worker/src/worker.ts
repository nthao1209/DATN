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

    const client = mqtt.connect(`${config.mqtt.protocol}://${config.mqtt.host}:${config.mqtt.port}`, {
        username: config.mqtt.username,
        password: config.mqtt.password,
        clientId: `worker_${prj}_${Math.random().toString(16).slice(3)}`,
        clean: true,
    });

    const uiTopicPrefix = config.mqtt.uiTopicPrefix || 'attendance/ui/trip';
    const unlockRequestTopic = 'attendance/backend/unlock-requests';

    const createNotification = async (userId: number, type: string, title: string, content: string, payload: Record<string, unknown>) => {
        if (!Number.isInteger(userId) || userId <= 0) return;

        const exists = await pool.query(
            `SELECT id FROM "Notification"
             WHERE "userId" = $1
               AND type = $2
               AND (payload->>'transactionId')::int = $3
               AND (payload->>'passengerId')::int = $4
             ORDER BY "createdAt" DESC
             LIMIT 1`,
            [userId, type, Number(payload.transactionId || 0), Number(payload.passengerId || 0)]
        );

        if (exists.rows.length > 0) {
            return;
        }

        await pool.query(
            `INSERT INTO "Notification" ("userId", type, title, content, payload, "isRead", "createdAt")
             VALUES ($1, $2, $3, $4, $5, false, NOW())`,
            [userId, type, title, content, JSON.stringify(payload)]
        );
    };

    client.on('connect', () => {
        parentPort?.postMessage(`[${prj}] Connected.`);
        client.subscribe(config.mqtt.topic);
        client.subscribe(unlockRequestTopic);
    });

    const handleAttendanceMessage = async (_topic: string, data: any) => {
        try {
            console.log(`📥 [${prj}] Received attendance message:`, data);

            if (!data.passengerId || !data.roundId || !data.busId) {
                throw new Error('Dữ liệu thiếu passengerId, roundId hoặc busId');
            }

            if ((data.checkIn && !data.checkInBy) || (data.checkOut && !data.checkOutBy)) {
                console.warn(`⚠️  [${prj}] WARNING - Missing user info:`, {
                    checkIn: data.checkIn,
                    checkInBy: data.checkInBy,
                    checkOut: data.checkOut,
                    checkOutBy: data.checkOutBy,
                });
            }

            const now = Date.now();
            const checkInAt = data.checkIn ? new Date(now) : null;
            const checkOutAt = data.checkOut ? new Date(now) : null;

            const parseOperatorToInt = (val: any) => {
                if (val === undefined || val === null) return null;
                const n = Number(val);
                return Number.isInteger(n) ? n : null;
            };

            const candidateIn = data.checkInBy ?? data.user ?? data.operator;
            const candidateOut = data.checkOutBy ?? data.user ?? data.operator;

            const checkInBy = data.checkIn ? parseOperatorToInt(candidateIn) : null;
            const checkOutBy = data.checkOut ? parseOperatorToInt(candidateOut) : null;

            if (data.checkIn && candidateIn !== undefined && checkInBy === null) {
                console.warn(`⚠️  [${prj}] NOTE - checkInBy present but not numeric, storing NULL`);
            } else if (data.checkIn && candidateIn === undefined) {
                console.warn(`⚠️  [${prj}] NOTE - checkInBy missing, storing NULL`);
            }

            if (data.checkOut && candidateOut !== undefined && checkOutBy === null) {
                console.warn(`⚠️  [${prj}] NOTE - checkOutBy present but not numeric, storing NULL`);
            } else if (data.checkOut && candidateOut === undefined) {
                console.warn(`⚠️  [${prj}] NOTE - checkOutBy missing, storing NULL`);
            }

            const existingRes = await pool.query(`SELECT * FROM "Transaction" WHERE "passengerId" = $1 AND "roundId" = $2`, [data.passengerId, data.roundId]);
            const existing = existingRes.rows[0];

            let result: any = null;
            if (existing) {
                const updateRes = await pool.query(
                    `UPDATE "Transaction" SET "busId" = $1, "checkIn" = $2, "checkOut" = $3, "note" = $4 WHERE id = $5 RETURNING *`,
                    [data.busId, Boolean(data.checkIn), Boolean(data.checkOut), data.note || '', existing.id]
                );
                result = updateRes.rows[0];
            } else {
                const insertRes = await pool.query(
                    `INSERT INTO "Transaction" ("passengerId", "roundId", "busId", "checkIn", "checkOut", "note") VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
                    [data.passengerId, data.roundId, data.busId, Boolean(data.checkIn), Boolean(data.checkOut), data.note || '']
                );
                result = insertRes.rows[0];
            }

            if (!result) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`⏭️ [${prj}] Ignored stale attendance payload for Passenger ${data.passengerId} in Round ${data.roundId}`);
                }
                return;
            }

            // Resolve tripId and passenger/bus/round info
            const busRes = await pool.query(`SELECT b.id, b."busCode", b."registrationNumber", b."managerId", t.id as "tripId" FROM "Bus" b LEFT JOIN "Trip" t ON b."tripId" = t.id WHERE b.id = $1`, [result.busId]);
            const busInfo = busRes.rows[0] || null;
            const tripId = busInfo?.tripId ?? null;
            if (!tripId) {
                if (process.env.NODE_ENV === 'development') parentPort?.postMessage(`⚠️ [${prj}] Could not determine tripId for bus ${result.busId}, skipping realtime publish`);
                return;
            }

            const passengerRes = await pool.query(`SELECT p.id, p.name, p."busId", b."busCode", b."registrationNumber", b."managerId" FROM "Passenger" p JOIN "Bus" b ON b.id = p."busId" WHERE p.id = $1`, [result.passengerId]);
            const passengerInfo = passengerRes.rows[0] || null;
            const roundRes = await pool.query(`SELECT id, name FROM "Round" WHERE id = $1`, [result.roundId]);
            const roundInfo = roundRes.rows[0] || null;

            const resolveEventBusIdByActor = async (actorId: number | null, fallbackBusId: number) => {
                if (!actorId || !tripId) return fallbackBusId;
                const actorBusRes = await pool.query(`SELECT id FROM "Bus" WHERE "tripId" = $1 AND "managerId" = $2 ORDER BY id ASC LIMIT 1`, [tripId, actorId]);
                return actorBusRes.rows[0]?.id ?? fallbackBusId;
            };

            const eventCheckInBusId = await resolveEventBusIdByActor(checkInBy, data.busId);
            const eventCheckOutBusId = await resolveEventBusIdByActor(checkOutBy, data.busId);

            // create attendance events for newly enabled actions
            if (result.checkIn && !(existing?.checkIn)) {
                const at = checkInAt ?? new Date();
                await pool.query(`INSERT INTO "AttendanceEvent" ("transactionId", action, "actorId", "busId", note, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`, [result.id, 'CHECK_IN_ON', checkInBy, eventCheckInBusId, data.note || '', at]);
            }

            if (!result.checkIn && existing?.checkIn) {
                const at = checkInAt ?? new Date();
                await pool.query(`INSERT INTO "AttendanceEvent" ("transactionId", action, "actorId", "busId", note, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`, [result.id, 'CHECK_IN_OFF', checkInBy, eventCheckInBusId, data.note || '', at]);
            }

            if (result.checkOut && !(existing?.checkOut)) {
                const at = checkOutAt ?? new Date();
                await pool.query(`INSERT INTO "AttendanceEvent" ("transactionId", action, "actorId", "busId", note, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`, [result.id, 'CHECK_OUT_ON', checkOutBy, eventCheckOutBusId, data.note || '', at]);
            }

            if (!result.checkOut && existing?.checkOut) {
                const at = checkOutAt ?? new Date();
                await pool.query(`INSERT INTO "AttendanceEvent" ("transactionId", action, "actorId", "busId", note, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`, [result.id, 'CHECK_OUT_OFF', checkOutBy, eventCheckOutBusId, data.note || '', at]);
            }

            const checkInEventRes = await pool.query(`SELECT "actorId", "createdAt", "busId" FROM "AttendanceEvent" WHERE "transactionId" = $1 AND action IN ('CHECK_IN_ON','CHECK_IN_OFF') ORDER BY "createdAt" DESC LIMIT 1`, [result.id]);
            const checkOutEventRes = await pool.query(`SELECT "actorId", "createdAt", "busId" FROM "AttendanceEvent" WHERE "transactionId" = $1 AND action IN ('CHECK_OUT_ON','CHECK_OUT_OFF') ORDER BY "createdAt" DESC LIMIT 1`, [result.id]);

            const checkInEvent = checkInEventRes.rows[0] || null;
            const checkOutEvent = checkOutEventRes.rows[0] || null;

            // decide latest event bus id
            let latestEventBusId = result.busId;
            if (checkInEvent?.createdAt && checkOutEvent?.createdAt) {
                latestEventBusId = new Date(checkOutEvent.createdAt).getTime() > new Date(checkInEvent.createdAt).getTime() ? checkOutEvent.busId : checkInEvent.busId;
            } else if (checkOutEvent?.busId) {
                latestEventBusId = checkOutEvent.busId;
            } else if (checkInEvent?.busId) {
                latestEventBusId = checkInEvent.busId;
            }

            const actualBusRes = await pool.query(`SELECT b.id, b."busCode", b."registrationNumber", b."managerId", u.name as "managerName" FROM "Bus" b LEFT JOIN "User" u ON u.id = b."managerId" WHERE b.id = $1`, [latestEventBusId]);
            const actualBus = actualBusRes.rows[0] || null;

            const isMisassigned = passengerInfo && Number(passengerInfo.busId) !== Number(latestEventBusId);
            const actualManagerId = actualBus?.managerId ?? null;
            const assignedManagerId = passengerInfo?.managerId ?? null;

            const checkInNeedsReview = Boolean(actualManagerId && checkInEvent?.actorId && Number(checkInEvent.actorId) !== Number(actualManagerId));
            const checkOutNeedsReview = Boolean(actualManagerId && checkOutEvent?.actorId && Number(checkOutEvent.actorId) !== Number(actualManagerId));

            const requiresReview = Boolean(isMisassigned || checkInNeedsReview || checkOutNeedsReview);
            const targetManagerId = isMisassigned ? assignedManagerId : actualManagerId;

            if (requiresReview && targetManagerId) {
                const title = isMisassigned ? 'Khách sai xe' : 'Điểm danh cần xem lại';
                const content = `Khách ${passengerInfo?.name || `#${result.passengerId}`} của xe ${passengerInfo?.busCode || passengerInfo?.busId} vừa được điểm danh trên xe ${actualBus?.busCode || latestEventBusId} ở chặng ${roundInfo?.name || result.roundId} bởi trưởng xe ${actualBus?.managerName || actualManagerId || 'không xác định'}.`;

                await createNotification(targetManagerId, 'attendance.requires_review', title, content, {
                    tripId,
                    busId: latestEventBusId,
                    roundId: result.roundId,
                    passengerId: result.passengerId,
                    transactionId: result.id,
                    targetManagerId,
                    requiresReview: true,
                    checkIn: result.checkIn,
                    checkOut: result.checkOut,
                    checkInBy: checkInEvent?.actorId || null,
                    checkOutBy: checkOutEvent?.actorId || null,
                });
            }

            // publish compact payload
            const basePayload: any = {
                project: prj,
                tripId,
                roundId: result.roundId,
                roundName: roundInfo?.name,
                busId: latestEventBusId,
                passengerId: result.passengerId,
                passengerBusId: passengerInfo?.busId,
                passengerBusManagerId: passengerInfo?.managerId,
                checkIn: result.checkIn,
                checkInAt: checkInEvent?.createdAt || null,
                checkInBy: checkInEvent?.actorId || null,
                checkOut: result.checkOut,
                checkOutAt: checkOutEvent?.createdAt || null,
                checkOutBy: checkOutEvent?.actorId || null,
                targetManagerId,
                requiresReview,
            };

            if (requiresReview) {
                client.publish(`${uiTopicPrefix}/${tripId}`, JSON.stringify({ type: 'attendance.requires_review', ...basePayload }), { qos: 1 });
            } else {
                client.publish(`${uiTopicPrefix}/${tripId}`, JSON.stringify({ type: 'attendance.updated', ...basePayload }), { qos: 1 });
            }

            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [${prj}] Updated Attendance: Passenger ${data.passengerId} in Round ${data.roundId}`);
                console.log(`📌 [${prj}] DB Update Success: TransID ${result.id}`);
            }
        } catch (e: any) {
            parentPort?.postMessage(`❌ [${prj}] Attendance Error: ${e.message}`);
        }
    };

    const handleUnlockMessage = async (_topic: string, data: any) => {
        try {
            const { action, requestId, approvedBy, rejectReason } = data;
            if (!action) throw new Error('Missing action');

            if (action === 'approve') {
                const requestRes = await pool.query(`SELECT * FROM "UnlockRequest" WHERE id = $1`, [requestId]);
                if (requestRes.rows.length === 0) throw new Error('Unlock request not found');
                const request = requestRes.rows[0];
                if (request.status !== 'PENDING') return;
                await pool.query(`UPDATE "BusRoundStatus" SET "checkInLocked" = CASE WHEN $3 = 'check_in' THEN false ELSE "checkInLocked" END, "checkOutLocked" = CASE WHEN $3 = 'check_out' THEN false ELSE "checkOutLocked" END WHERE "busId" = $1 AND "roundId" = $2`, [request.busId, request.roundId, request.type]);
                await pool.query(`UPDATE "UnlockRequest" SET status = 'APPROVED', "approvedBy" = $2, "respondedAt" = NOW() WHERE id = $1`, [requestId, approvedBy]);
                const busRes = await pool.query(`SELECT b.*, t.id as "tripId" FROM "Bus" b JOIN "Trip" t ON b."tripId" = t.id WHERE b.id = $1`, [request.busId]);
                const bus = busRes.rows[0];
                client.publish(`${uiTopicPrefix}/${bus.tripId}`, JSON.stringify({ type: 'unlock.request.approved', requestId, busId: request.busId, roundId: request.roundId, lockType: request.type }), { qos: 1 });
                parentPort?.postMessage(`✅ Approved request ${requestId}`);
            } else if (action === 'reject') {
                const requestRes = await pool.query(`SELECT * FROM "UnlockRequest" WHERE id = $1`, [requestId]);
                if (requestRes.rows.length === 0) throw new Error('Unlock request not found');
                const request = requestRes.rows[0];
                if (request.status !== 'PENDING') return;
                await pool.query(`UPDATE "UnlockRequest" SET status = 'REJECTED', "approvedBy" = $2, "respondedAt" = NOW() WHERE id = $1`, [requestId, approvedBy]);
                const busRes = await pool.query(`SELECT b.*, t.id as "tripId" FROM "Bus" b JOIN "Trip" t ON b."tripId" = t.id WHERE b.id = $1`, [request.busId]);
                const bus = busRes.rows[0];
                client.publish(`${uiTopicPrefix}/${bus.tripId}`, JSON.stringify({ type: 'unlock.request.rejected', requestId, busId: request.busId, roundId: request.roundId, rejectReason: rejectReason || '' }), { qos: 1 });
                parentPort?.postMessage(`❌ Rejected request ${requestId}`);
            }
        } catch (e: any) {
            parentPort?.postMessage(`❌ Unlock error: ${e.message}`);
        }
    };

    client.on('message', async (topic, msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (topic === unlockRequestTopic) {
                await handleUnlockMessage(topic, data);
            } else {
                await handleAttendanceMessage(topic, data);
            }
        } catch (e: any) {
            parentPort?.postMessage(`❌ Parse error: ${e.message}`);
        }
    });

    setInterval(async () => {
        const total = pool.totalCount;
        const idle = pool.idleCount;
        if (total > 0) {
            parentPort?.postMessage(`📊 [${prj}] DB Pool Status: Total ${total}, Idle ${idle}`);
        }
    }, 60000);
}

init().catch(err => parentPort?.postMessage(`🔥 Fatal: ${err.message}`));

