import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';
import systemAdminRoutes from './routes/system-admin';
import busManagementRoutes from './routes/bus-management';
import { startAttendanceMqttConsumer, stopAttendanceMqttConsumer } from './services/attendanceMqttConsumer';
import { getMqttClient } from './services/mqtt';
dotenv.config()


const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', publicRoutes);
app.use('/api', adminRoutes);
app.use('/api', systemAdminRoutes);
app.use('/api', busManagementRoutes);

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.get('/api/_routes', (_req, res) => {
  try {
    const routes: string[] = (app as any)._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        return `${methods} ${layer.route.path}`;
      });
    res.json({ routes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to enumerate routes' });
  }
});

const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
  startAttendanceMqttConsumer();
})

const shutdown = () => {
  stopAttendanceMqttConsumer();
  getMqttClient().end(true);
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);