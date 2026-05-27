import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const CONFIG_PATH = isProd
    ? '/etc/secrets/transaction.config.json'
    : path.join(__dirname, '../configs/transaction.config.json');
console.log('🚀 [Master] Hệ thống đang khởi động...');
console.log(`📂 [Master] File cấu hình: ${CONFIG_PATH}`);
if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ Không tìm thấy file config!');
    process.exit(1);
}
function startProject(configPath) {
    const fileName = path.basename(configPath);
    console.log(`🚀 [Master] Đang khởi tạo dự án: ${fileName}`);
    const worker = new Worker(new URL(isProd ? './worker.js' : './worker.ts', import.meta.url), {
        workerData: { configPath },
        execArgv: isProd ? [] : ['--loader', 'ts-node/esm']
    });
    worker.on('message', (msg) => {
        console.log(`[${fileName}] ${msg}`);
    });
    worker.on('error', (err) => {
        console.error(`[${fileName}] Worker lỗi:`, err.message);
    });
    worker.on('exit', (code) => {
        console.log(`[${fileName}] Worker dừng (code ${code}), restart sau 5s...`);
        setTimeout(() => {
            startProject(configPath);
        }, 5000);
    });
}
startProject(CONFIG_PATH);
//# sourceMappingURL=master.js.map