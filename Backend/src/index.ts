import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import tenantRoutes from './routes/tenantRoute'
import authRoutes from './routes/authRoute'
import tripRoutes from './routes/tripRoute';
import roundRoutes from './routes/roundRoute';
import busRoutes from './routes/busRoute';
import passengerRoutes from './routes/passengerRoute';
import userRoutes from './routes/userRoute';
import roleRoutes from './routes/roleRoute';
import transactionRoutes from './routes/transactionRoute';
import unlockRequestRoutes from './routes/unlockRequestRoute';
import notificationRoutes from './routes/notificationRoute';
dotenv.config()


const app = express()

app.use(cors())
app.use(express.json())

app.use('/api',tenantRoutes);
app.use('/api',authRoutes);
app.use('/api', tripRoutes);
app.use('/api', roundRoutes);
app.use('/api', busRoutes);
app.use('/api', passengerRoutes);
app.use('/api', userRoutes);
app.use('/api', roleRoutes);
app.use('/api', transactionRoutes);
app.use('/api/unlock-requests', unlockRequestRoutes);
app.use('/api', notificationRoutes);

// Debug: list registered routes (temporary)
app.get('/api/_routes', (_req, res) => {
  try {
    // @ts-ignore: access express internals for debugging
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})