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


    client.on('connect', () => {
        parentPort?.postMessage(`[${prj}] Connected.`);
        client.subscribe(config.mqtt.topic);
    });

    client.on('message', async (_topic: string, msg: Buffer) => {
        try{
            const data = JSON.parse(msg.toString());

            if (!data.passengerId || !data.roundId || !data.busId) {
                throw new Error("Dữ liệu thiếu passengerId, roundId hoặc busId");
            }
            const now = Date.now();
            const checkInAt = data.checkIn ? new Date(now) : null;
            const checkOutAt = data.checkOut ? new Date(now) : null;
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
                SELECT ur.*, b."tripId" 
                FROM upsert_res ur
                JOIN "Bus" b ON b.id = ur."busId";
            `;

             const values = [
                data.passengerId,
                data.roundId,
                data.busId,
                Boolean(data.checkIn), // Ép kiểu Boolean
                checkInAt,
                data.checkInBy || null,
                Boolean(data.checkOut), // Ép kiểu Boolean
                checkOutAt,
                data.checkOutBy || null,
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
                client.publish(
                    `${uiTopicPrefix}/${result.tripId}`,
                    JSON.stringify({
                        type: 'attendance.updated',
                        project: prj,
                        tripId: result.tripId,
                        passengerId: result.passengerId,
                        roundId: result.roundId,
                        busId: result.busId,
                        checkIn: result.checkIn,
                        checkInAt: result.checkInAt,
                        checkOut: result.checkOut,
                        checkOutAt: result.checkOutAt,
                        note: result.note,
                    }),
                    { qos: 1 }
                );
            }


            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [${prj}] Updated Attendance: Passenger ${data.passengerId} in Round ${data.roundId}`);
                 console.log(`📌 [${prj}] DB Update Success: TransID ${result.id}`);
            }

        } catch (e: any) {
            parentPort?.postMessage(`❌ [${prj}] SQL Error: ${e.message}`);
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