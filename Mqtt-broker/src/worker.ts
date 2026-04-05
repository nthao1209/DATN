import { workerData, parentPort } from 'node:worker_threads';
import mqtt from 'mqtt';
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import { type AppConfig } from './types.js';

async function init() {
    let config: AppConfig;
    try {
        const rawConfig = fs.readFileSync(workerData.configPath, 'utf8');
        config = JSON.parse(rawConfig);
    } catch (e: any) {
        parentPort?.postMessage(`❌ Lỗi cấu hình: ${e.message}`);
        return;
    }

    const prj = config.project_name;
    const isDev = process.env.NODE_ENV === 'development';

    const pool = mysql.createPool({ ...config.mysql, connectionLimit: 5 });

    const client = mqtt.connect(`${config.mqtt.protocol}://${config.mqtt.host}:${config.mqtt.port}`, {
        username: config.mqtt.username,
        password: config.mqtt.password,
        clientId: `worker_${prj}_${Math.random().toString(16).slice(3)}`
    });

    let buffer: any[] = [];

    client.on('connect', () => {
        parentPort?.postMessage(`✅ [${prj}] Connected.`);
        client.subscribe(config.mqtt.topic);
    });

    client.on('message', (topic, msg) => {
        const rawString = msg.toString();
        
        // --- XỬ LÝ DEVICE ID (Mặc định là true nếu không khai báo) ---
        let deviceId: string | null = null;
        const useDeviceId = config.data_struct.DeviceId !== false; 

        if (useDeviceId) {
            const topicParts = topic.split('/');
            deviceId = topicParts[1] || 'unknown';
        }

        try {
            const raw = rawString.split(',');
            const data: any = {};
            
            if (useDeviceId) data['DeviceId'] = deviceId; 

            config.data_struct.columns.forEach((col, i) => {
                const type = config.data_struct.types[i];
                const rawValue = raw[i]?.trim();
                if (type === 'float') data[col] = parseFloat(rawValue ?? "0") || 0;
                else if (type === 'int') data[col] = parseInt(rawValue ?? "0") || 0;
                else data[col] = rawValue ?? "";
            });

            buffer.push(data);
            if (isDev) console.log(`📩 [${prj}] Recv: ${rawString}`);
        } catch (e: any) {
            parentPort?.postMessage(`❌ [${prj}] Parse Error: ${e.message}`);
        }
    });

    // --- CƠ CHẾ LƯU DATABASE ---
    setInterval(async () => {
        if (buffer.length === 0) return;

        const currentData = [...buffer];
        buffer = [];

        // TRƯỜNG HỢP 1: METHOD = 'COPY'
        if (config.aggregation.method === 'copy') {
            for (const item of currentData) {
                try {
                    await pool.query(`INSERT INTO ${config.mysql.table} SET ?`, item);
                } catch (e: any) {
                    parentPort?.postMessage(`❌ [${prj}] DB Copy Error: ${e.message}`);
                }
            }
            if (isDev) parentPort?.postMessage(`💾 [${prj}] Copied ${currentData.length} records.`);
            return; 
        }

        // TRƯỜNG HỢP 2: TÍNH TRUNG BÌNH (Mặc định)
        const grouped = currentData.reduce((acc: Record<string, any[]>, obj: any) => {
            const key = obj.DeviceId || 'default';
            if (!acc[key]) acc[key] = [];
            acc[key].push(obj);
            return acc;
        }, {});

        for (const [id, items] of Object.entries(grouped)) {
            const count = items.length;
            const payload: any = {};
            if (id !== 'default') payload['DeviceId'] = id;

            config.aggregation.target_columns.forEach(col => {
                const sum = items.reduce((a, b) => a + (b[col] || 0), 0);
                payload[col] = sum / count;
            });

            // Gán các cột dạng string (lấy bản ghi cuối cùng)
            config.data_struct.columns.forEach((col, i) => {
                if (config.data_struct.types[i] === 'string' && col !== 'DeviceId') {
                    payload[col] = items[items.length - 1][col];
                }
            });

            try {
                await pool.query(`INSERT INTO ${config.mysql.table} SET ?`, payload);
            } catch (e: any) {
                parentPort?.postMessage(`❌ [${prj}] DB Avg Error: ${e.message}`);
            }
        }
    }, config.aggregation.interval_seconds * 1000);
}

init().catch(err => parentPort?.postMessage(`🔥 Fatal: ${err.message}`));