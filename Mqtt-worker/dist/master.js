import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const CONFIG_PATH = process.env.CONFIG_PATH ||
    path.join(__dirname, '../configs/transaction.config.json');
if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config not found: ${CONFIG_PATH}`);
    process.exit(1);
}
function startProject(configPath) {
    // Master chỉ có nhiệm vụ khởi chạy worker và tự restart nếu worker lỗi/crash.
    const worker = new Worker(new URL(isProd ? './worker.js' : './worker.ts', import.meta.url), {
        workerData: { configPath },
        execArgv: isProd ? [] : ['--loader', 'ts-node/esm']
    });
    worker.on('message', (message) => {
        console.log(message);
    });
    worker.on('error', (error) => {
        console.error(error);
    });
    worker.on('exit', (code) => {
        // Worker xử lý MQTT liên tục; nếu chết thì đợi 5s rồi chạy lại để không mất service.
        console.error(`Worker exited with code ${code}. Restarting in 5s.`);
        setTimeout(() => {
            startProject(configPath);
        }, 5000);
    });
}
startProject(CONFIG_PATH);
//# sourceMappingURL=master.js.map