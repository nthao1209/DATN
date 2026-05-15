import { workerData, parentPort } from 'node:worker_threads';
import mqtt from 'mqtt';
import fs from 'node:fs';
import pkg from 'pg';
const { Pool } = pkg;
async function init() {
    let config;
    try {
        const rawConfig = fs.readFileSync(workerData.configPath, 'utf8');
        config = JSON.parse(rawConfig);
    }
    catch (e) {
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
    const adminUnlockTopicPrefix = 'attendance/admin/unlock-requests';
    client.on('connect', () => {
        parentPort?.postMessage(`[${prj}] Connected.`);
        client.subscribe(config.mqtt.topic);
        client.subscribe(unlockRequestTopic);
    });
    // Handler cho attendance updates
    const handleAttendanceMessage = async (_topic, data) => {
        try {
            console.log(`📥 [${prj}] Received attendance message:`, data);
            if (!data.passengerId || !data.roundId || !data.busId) {
                throw new Error("Dữ liệu thiếu passengerId, roundId hoặc busId");
            }
            // Validate checkInBy and checkOutBy fields
            if ((data.checkIn && !data.checkInBy) || (data.checkOut && !data.checkOutBy)) {
                console.warn(`⚠️  [${prj}] WARNING - Missing user info:`, {
                    checkIn: data.checkIn,
                    checkInBy: data.checkInBy,
                    checkOut: data.checkOut,
                    checkOutBy: data.checkOutBy
                });
            }
            const now = Date.now();
            const checkInAt = data.checkIn ? new Date(now) : null;
            const checkOutAt = data.checkOut ? new Date(now) : null;
            // Derive operator fields: prefer explicit fields from message, then try common aliases.
            // Parse to integer if possible; otherwise use null to match DB integer column.
            const parseOperatorToInt = (val) => {
                if (val === undefined || val === null)
                    return null;
                const n = Number(val);
                return Number.isInteger(n) ? n : null;
            };
            const candidateIn = data.checkInBy ?? data.user ?? data.operator;
            const candidateOut = data.checkOutBy ?? data.user ?? data.operator;
            const checkInBy = data.checkIn ? parseOperatorToInt(candidateIn) : null;
            const checkOutBy = data.checkOut ? parseOperatorToInt(candidateOut) : null;
            if (data.checkIn && candidateIn !== undefined && checkInBy === null) {
                console.warn(`⚠️  [${prj}] NOTE - checkInBy present but not numeric, storing NULL`);
            }
            else if (data.checkIn && candidateIn === undefined) {
                console.warn(`⚠️  [${prj}] NOTE - checkInBy missing, storing NULL`);
            }
            if (data.checkOut && candidateOut !== undefined && checkOutBy === null) {
                console.warn(`⚠️  [${prj}] NOTE - checkOutBy present but not numeric, storing NULL`);
            }
            else if (data.checkOut && candidateOut === undefined) {
                console.warn(`⚠️  [${prj}] NOTE - checkOutBy missing, storing NULL`);
            }
            const query = `
             WITH upsert_res AS (
                    INSERT INTO "Transaction" (
                        "passengerId", "roundId", "busId", 
                        "checkIn", "checkInAt", "checkInBy", 
                        "checkOut", "checkOutAt", "checkOutBy", 
                        "note"
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT ("passengerId", "roundId") 
                    DO UPDATE SET 
                        "busId" = EXCLUDED."busId",
                        "checkIn" = EXCLUDED."checkIn",
                        "checkOut" = EXCLUDED."checkOut",
                        "note" = EXCLUDED."note",
                        "checkInAt" = CASE WHEN EXCLUDED."checkIn" THEN COALESCE("Transaction"."checkInAt", EXCLUDED."checkInAt") ELSE NULL END,
                        "checkOutAt" = CASE WHEN EXCLUDED."checkOut" THEN COALESCE("Transaction"."checkOutAt", EXCLUDED."checkOutAt") ELSE NULL END,
                        "checkInBy" = CASE WHEN EXCLUDED."checkIn" THEN COALESCE(EXCLUDED."checkInBy", "Transaction"."checkInBy") ELSE NULL END,
                        "checkOutBy" = CASE WHEN EXCLUDED."checkOut" THEN COALESCE(EXCLUDED."checkOutBy", "Transaction"."checkOutBy") ELSE NULL END
                    RETURNING *
                )
                SELECT ur.*, b."tripId", b."busCode", b."registrationNumber" 
                FROM upsert_res ur
                JOIN "Bus" b ON b.id = ur."busId";
            `;
            const values = [
                data.passengerId,
                data.roundId,
                data.busId,
                Boolean(data.checkIn), // Ép kiểu Boolean
                checkInAt,
                checkInBy,
                Boolean(data.checkOut), // Ép kiểu Boolean
                checkOutAt,
                checkOutBy,
                data.note || ""
            ];
            const res = await pool.query(query, values);
            const result = res.rows[0];
            if (!result) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`⏭️ [${prj}] Ignored stale attendance payload for Passenger ${data.passengerId} in Round ${data.roundId}`);
                }
                return;
            }
            if (result && result.tripId) {
                const passengerRes = await pool.query(`SELECT p.id, p.name, p."busId", b."busCode", b."registrationNumber", b."managerId", u.name AS "managerName"
                     FROM "Passenger" p
                     JOIN "Bus" b ON b.id = p."busId"
                     LEFT JOIN "User" u ON u.id = b."managerId"
                     WHERE p.id = $1`, [result.passengerId]);
                const passengerInfo = passengerRes.rows[0];
                const roundRes = await pool.query(`SELECT id, name FROM "Round" WHERE id = $1`, [result.roundId]);
                const roundInfo = roundRes.rows[0];
                const isMisassigned = passengerInfo && Number(passengerInfo.busId) !== Number(result.busId);
                client.publish(`${uiTopicPrefix}/${result.tripId}`, JSON.stringify({
                    type: 'attendance.updated',
                    project: prj,
                    tripId: result.tripId,
                    passengerId: result.passengerId,
                    passengerName: passengerInfo?.name,
                    passengerBusId: passengerInfo?.busId,
                    passengerBusCode: passengerInfo?.busCode,
                    passengerBusRegistrationNumber: passengerInfo?.registrationNumber,
                    passengerBusManagerId: passengerInfo?.managerId,
                    passengerBusManagerName: passengerInfo?.managerName,
                    actualBusCode: result.busCode,
                    actualBusRegistrationNumber: result.registrationNumber,
                    targetManagerId: isMisassigned ? passengerInfo?.managerId : null,
                    targetManagerName: isMisassigned ? passengerInfo?.managerName : undefined,
                    roundId: result.roundId,
                    roundName: roundInfo?.name,
                    busId: result.busId,
                    busCode: result.busCode,
                    checkIn: result.checkIn,
                    checkInAt: result.checkInAt,
                    checkInBy: result.checkInBy,
                    checkOut: result.checkOut,
                    checkOutAt: result.checkOutAt,
                    checkOutBy: result.checkOutBy,
                    note: result.note,
                }), { qos: 1 });
            }
            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [${prj}] Updated Attendance: Passenger ${data.passengerId} in Round ${data.roundId}`);
                console.log(`📌 [${prj}] DB Update Success: TransID ${result.id}`);
            }
        }
        catch (e) {
            parentPort?.postMessage(`❌ [${prj}] Attendance Error: ${e.message}`);
        }
    };
    const handleUnlockMessage = async (_topic, data) => {
        try {
            const { action, requestId, approvedBy, rejectReason } = data;
            if (!action)
                throw new Error("Missing action");
            // =========================
            // APPROVE
            // =========================
            if (action === 'approve') {
                const requestRes = await pool.query(`SELECT * FROM "UnlockRequest" WHERE id = $1`, [requestId]);
                if (requestRes.rows.length === 0) {
                    throw new Error("Unlock request not found");
                }
                const request = requestRes.rows[0];
                if (request.status !== 'PENDING')
                    return;
                // 1. unlock bus state
                await pool.query(`UPDATE "BusRoundStatus"
                     SET "checkInLocked" = CASE WHEN $3 = 'check_in' THEN false ELSE "checkInLocked" END,
                         "checkOutLocked" = CASE WHEN $3 = 'check_out' THEN false ELSE "checkOutLocked" END
                     WHERE "busId" = $1 AND "roundId" = $2`, [request.busId, request.roundId, request.type]);
                // 2. update request
                await pool.query(`UPDATE "UnlockRequest"
                     SET status = 'APPROVED',
                         "approvedBy" = $2,
                         "respondedAt" = NOW()
                     WHERE id = $1`, [requestId, approvedBy]);
                const busRes = await pool.query(`SELECT b.*, t.id as "tripId"
                     FROM "Bus" b JOIN "Trip" t ON b."tripId" = t.id
                     WHERE b.id = $1`, [request.busId]);
                const bus = busRes.rows[0];
                client.publish(`${uiTopicPrefix}/${bus.tripId}`, JSON.stringify({
                    type: 'unlock.request.approved',
                    requestId,
                    busId: request.busId,
                    roundId: request.roundId,
                    lockType: request.type,
                }), { qos: 1 });
                parentPort?.postMessage(`✅ Approved request ${requestId}`);
            }
            // =========================
            // REJECT
            // =========================
            else if (action === 'reject') {
                const requestRes = await pool.query(`SELECT * FROM "UnlockRequest" WHERE id = $1`, [requestId]);
                if (requestRes.rows.length === 0) {
                    throw new Error("Unlock request not found");
                }
                const request = requestRes.rows[0];
                if (request.status !== 'PENDING')
                    return;
                await pool.query(`UPDATE "UnlockRequest"
                     SET status = 'REJECTED',
                         "approvedBy" = $2,
                         "respondedAt" = NOW()
                     WHERE id = $1`, [requestId, approvedBy]);
                const busRes = await pool.query(`SELECT b.*, t.id as "tripId"
                     FROM "Bus" b JOIN "Trip" t ON b."tripId" = t.id
                     WHERE b.id = $1`, [request.busId]);
                const bus = busRes.rows[0];
                client.publish(`${uiTopicPrefix}/${bus.tripId}`, JSON.stringify({
                    type: 'unlock.request.rejected',
                    requestId,
                    busId: request.busId,
                    roundId: request.roundId,
                    rejectReason: rejectReason || '',
                }), { qos: 1 });
                parentPort?.postMessage(`❌ Rejected request ${requestId}`);
            }
        }
        catch (e) {
            parentPort?.postMessage(`❌ Unlock error: ${e.message}`);
        }
    };
    // =========================
    // MQTT ROUTER
    // =========================
    client.on('message', async (topic, msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (topic === unlockRequestTopic) {
                await handleUnlockMessage(topic, data);
            }
            else {
                await handleAttendanceMessage(topic, data);
            }
        }
        catch (e) {
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
//# sourceMappingURL=worker.js.map