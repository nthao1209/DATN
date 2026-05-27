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

if (!fs.existsSync(CONFIG_PATH)) {
  process.exit(1);
}

function startProject(configPath: string) {
  const worker = new Worker(
    new URL(isProd ? './worker.js' : './worker.ts', import.meta.url),
    {
      workerData: { configPath },
      execArgv: isProd ? [] : ['--loader', 'ts-node/esm']
    }
  );

  worker.on('message', () => {
  });

  worker.on('error', () => {
  });

  worker.on('exit', () => {
    setTimeout(() => {
      startProject(configPath);
    }, 5000);
  });
}

startProject(CONFIG_PATH);