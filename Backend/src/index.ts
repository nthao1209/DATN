import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import tenantRoutes from './routes/tenantRoute'
import authRoutes from './routes/authRoute'
import tripRoutes from './routes/tripRoute';
import roundRoutes from './routes/roundRoute';
import busRoutes from './routes/busRoute';
import passengerRoutes from './routes/passengerRoute';
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

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})