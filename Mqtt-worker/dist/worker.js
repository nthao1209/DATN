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
            const existingRes = await pool.query(`SELECT * FROM "Transaction" WHERE "passengerId" = $1 AND "roundId" = $2`, [data.passengerId, data.roundId]);
            const existing = existingRes.rows[0];
            let result = null;
            if (existing) {
                const updateRes = await pool.query(`UPDATE "Transaction" SET "busId" = $1, "checkIn" = $2, "checkOut" = $3, "note" = $4 WHERE id = $5 RETURNING *`, [data.busId, Boolean(data.checkIn), Boolean(data.checkOut), data.note || '', existing.id]);
                result = updateRes.rows[0];
            }
            else {
                const insertRes = await pool.query(`INSERT INTO "Transaction" ("passengerId", "roundId", "busId", "checkIn", "checkOut", "note") VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [data.passengerId, data.roundId, data.busId, Boolean(data.checkIn), Boolean(data.checkOut), data.note || '']);
                result = insertRes.rows[0];
            }
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
                    if (result) {
                     WHERE p.id = $1`, [result.passengerId]);
                const passengerInfo = passengerRes.rows[0];
                const roundRes = await pool.query(`SELECT id, name FROM "Round" WHERE id = $1`, [result.roundId]);
                const roundInfo = roundRes.rows[0];
                const isMisassigned = passengerInfo && Number(passengerInfo.busId) !== Number(result.busId);
                if (result.checkIn && !(existing?.checkIn)) {
                    const at = checkInAt ?? new Date();
                    await pool.query(`INSERT INTO "AttendanceEvent" ("transactionId", action, "actorId", "busId", note, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`, [result.id, 'CHECK_IN_ON', checkInBy, data.busId, data.note || '', at]);
                }
                // create OFF when transitioned from true -> false
                if (!result.checkIn && (existing === null || existing === void 0 ? void 0 : existing.checkIn)) {
                    const at = checkInAt ?? new Date();
                    await pool.query(`INSERT INTO "AttendanceEvent" ("transactionId", action, "actorId", "busId", note, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`, [result.id, 'CHECK_IN_OFF', checkInBy, data.busId, data.note || '', at]);
                }
                if (result.checkOut && !(existing?.checkOut)) {
                    const at = checkOutAt ?? new Date();
                    await pool.query(`INSERT INTO "AttendanceEvent" ("transactionId", action, "actorId", "busId", note, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`, [result.id, 'CHECK_OUT_ON', checkOutBy, data.busId, data.note || '', at]);
                }
                if (!result.checkOut && (existing === null || existing === void 0 ? void 0 : existing.checkOut)) {
                    const at = checkOutAt ?? new Date();
                    await pool.query(`INSERT INTO "AttendanceEvent" ("transactionId", action, "actorId", "busId", note, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`, [result.id, 'CHECK_OUT_OFF', checkOutBy, data.busId, data.note || '', at]);
                }

                const checkInEventRes = await pool.query(`SELECT "actorId", "createdAt" FROM "AttendanceEvent" WHERE "transactionId" = $1 AND action = 'CHECK_IN_ON' ORDER BY "createdAt" ASC LIMIT 1`, [result.id]);
                const checkOutEventRes = await pool.query(`SELECT "actorId", "createdAt" FROM "AttendanceEvent" WHERE "transactionId" = $1 AND action = 'CHECK_OUT_ON' ORDER BY "createdAt" ASC LIMIT 1`, [result.id]);
                const checkInEvent = checkInEventRes.rows[0];
                const checkOutEvent = checkOutEventRes.rows[0];

                    // If check-in actor differs from assigned passenger bus manager, emit requires_review instead
                    const assignedManagerId = passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.managerId;
                    if (assignedManagerId && (checkInEvent === null || checkInEvent === void 0 ? void 0 : checkInEvent.actorId) && (checkInEvent === null || checkInEvent === void 0 ? void 0 : checkInEvent.actorId) !== assignedManagerId) {
                        client.publish(`${uiTopicPrefix}/${tripId}`, JSON.stringify({
                            type: 'attendance.requires_review',
                            project: prj,
                            tripId,
                            passengerId: result.passengerId,
                            passengerName: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.name,
                            passengerBusId: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.busId,
                            passengerBusCode: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.busCode,
                            passengerBusRegistrationNumber: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.registrationNumber,
                            passengerBusManagerId: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.managerId,
                            passengerBusManagerName: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.managerName,
                            actualBusCode: busInfo === null || busInfo === void 0 ? void 0 : busInfo.busCode,
                            actualBusRegistrationNumber: busInfo === null || busInfo === void 0 ? void 0 : busInfo.registrationNumber,
                            targetManagerId: isMisassigned ? passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.managerId : null,
                            targetManagerName: isMisassigned ? passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.managerName : undefined,
                            roundId: result.roundId,
                            roundName: roundInfo === null || roundInfo === void 0 ? void 0 : roundInfo.name,
                            busId: result.busId,
                            busCode: busInfo === null || busInfo === void 0 ? void 0 : busInfo.busCode,
                            checkIn: result.checkIn,
                            checkInAt: (checkInEvent === null || checkInEvent === void 0 ? void 0 : checkInEvent.createdAt) || null,
                            checkInBy: (checkInEvent === null || checkInEvent === void 0 ? void 0 : checkInEvent.actorId) || null,
                            checkOut: result.checkOut,
                            checkOutAt: (checkOutEvent === null || checkOutEvent === void 0 ? void 0 : checkOutEvent.createdAt) || null,
                            checkOutBy: (checkOutEvent === null || checkOutEvent === void 0 ? void 0 : checkOutEvent.actorId) || null,
                            note: result.note,
                            requiresReview: true,
                        }), { qos: 1 });
                    }
                    else {
                        client.publish(`${uiTopicPrefix}/${tripId}`, JSON.stringify({
                            type: 'attendance.updated',
                            project: prj,
                            tripId,
                            passengerId: result.passengerId,
                            passengerName: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.name,
                            passengerBusId: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.busId,
                            passengerBusCode: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.busCode,
                            passengerBusRegistrationNumber: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.registrationNumber,
                            passengerBusManagerId: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.managerId,
                            passengerBusManagerName: passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.managerName,
                            actualBusCode: busInfo === null || busInfo === void 0 ? void 0 : busInfo.busCode,
                            actualBusRegistrationNumber: busInfo === null || busInfo === void 0 ? void 0 : busInfo.registrationNumber,
                            targetManagerId: isMisassigned ? passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.managerId : null,
                            targetManagerName: isMisassigned ? passengerInfo === null || passengerInfo === void 0 ? void 0 : passengerInfo.managerName : undefined,
                            roundId: result.roundId,
                            roundName: roundInfo === null || roundInfo === void 0 ? void 0 : roundInfo.name,
                            busId: result.busId,
                            busCode: busInfo === null || busInfo === void 0 ? void 0 : busInfo.busCode,
                            checkIn: result.checkIn,
                            checkInAt: checkInEvent?.createdAt || null,
                            checkInBy: checkInEvent?.actorId || null,
                            checkOut: result.checkOut,
                            checkOutAt: checkOutEvent?.createdAt || null,
                            checkOutBy: checkOutEvent?.actorId || null,
                            note: result.note,
                        }), { qos: 1 });
                    }
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
                            client.publish(`${uiTopicPrefix}/${tripId}`, JSON.stringify({
                    targetManagerId: isMisassigned ? passengerInfo?.managerId : null,
                    targetManagerName: isMisassigned ? passengerInfo?.managerName : undefined,
                                tripId,
                    roundName: roundInfo?.name,
                    busId: result.busId,
                    busCode: result.busCode,
                    checkIn: result.checkIn,
                    checkInAt: checkInEvent?.createdAt || null,
                    checkInBy: checkInEvent?.actorId || null,
                    checkOut: result.checkOut,
                                actualBusCode: busInfo === null || busInfo === void 0 ? void 0 : busInfo.busCode,
                                actualBusRegistrationNumber: busInfo === null || busInfo === void 0 ? void 0 : busInfo.registrationNumber,
                    note: result.note,
                }), { qos: 1 });
            }
            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [${prj}] Updated Attendance: Passenger ${data.passengerId} in Round ${data.roundId}`);
                                busCode: busInfo === null || busInfo === void 0 ? void 0 : busInfo.busCode,
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