import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
//Xác định môi trường vận hành
const isProd = process.env.NODE_ENV === 'production';
const CONFIG_DIR = path.join(__dirname, '../configs');
console.log('🚀 [Master] Hệ thống đang khởi động...');
console.log(`📂 [Master] Thư mục cấu hình: ${CONFIG_DIR}`);
if (!fs.existsSync(CONFIG_DIR)) {
    console.log(' [Master] Không tìm thấy thư mục configs. Đang tạo mới...');
    fs.mkdirSync(CONFIG_DIR);
}
function startProject(configPath) {
    const fileName = path.basename(configPath);
    console.log(` [Master] Đang khởi tạo dự án từ file: ${fileName}`);
    const worker = new Worker(new URL(isProd ? './worker.js' : './worker.ts', import.meta.url), {
        workerData: { configPath },
        execArgv: isProd ? [] : ['--loader', 'ts-node/esm']
    });
    worker.on('message', (msg) => console.log(` [${fileName}] ${msg}`));
    worker.on('error', (err) => {
        console.error(` [${fileName}] Lỗi Worker:`, err.message);
    });
    worker.on('exit', (code) => {
        console.log(`[${fileName}] Worker dừng (Code: ${code}). Khởi động lại sau 5s...`);
        setTimeout(() => startProject(configPath), 5000);
    });
}
const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.config.json'));
if (files.length === 0) {
    console.log(' [Master] Không tìm thấy file .config.json nào trong thư mục /configs!');
    console.log('Hãy tạo một file ví dụ: configs/duan1.config.json và chạy lại.');
}
else {
    console.log(` [Master] Tìm thấy ${files.length} dự án. Đang bắt đầu...`);
    files.forEach(file => startProject(path.join(CONFIG_DIR, file)));
}
//# sourceMappingURL=master.js.map