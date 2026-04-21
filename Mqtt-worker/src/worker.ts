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
            const query = `
                INSERT INTO "Transaction" ("passengerId", "roundId", "busId", "checkIn", "checkOut", "note", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT ("passengerId", "roundId") 
                DO UPDATE SET 
                    "checkIn" = EXCLUDED."checkIn",
                    "checkOut" = EXCLUDED."checkOut",
                    "note" = EXCLUDED."note",
                    "updatedAt" = NOW()
                RETURNING id;
            `;
            const values = [
                data.passengerId,
                data.roundId,
                data.busId,
                data.checkIn || false,
                data.checkOut || false,
                data.note || ""
            ];
            
            const res = await pool.query(query, values);
            const updatedInfo = res.rows[0];

            const tripLookup = await pool.query(
                'SELECT "tripId" FROM "Bus" WHERE id = $1 LIMIT 1',
                [data.busId]
            );
            const tripId = Number(tripLookup.rows[0]?.tripId || 0);

            if (tripId) {
                client.publish(
                    `${uiTopicPrefix}/${tripId}`,
                    JSON.stringify({
                        type: 'attendance.updated',
                        project: prj,
                        tripId,
                        passengerId: data.passengerId,
                        roundId: data.roundId,
                        busId: data.busId,
                        checkIn: Boolean(data.checkIn),
                        checkOut: Boolean(data.checkOut),
                        note: data.note || '',
                        updatedAt: new Date().toISOString(),
                    }),
                    { qos: 1, retain: false }
                );
            }

            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [${prj}] Updated Attendance: Passenger ${data.passengerId} in Round ${data.roundId}`);
                 console.log(`📌 [${prj}] DB Update Success: TransID ${updatedInfo.id}`);
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