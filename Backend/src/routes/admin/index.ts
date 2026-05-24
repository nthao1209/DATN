import { Router } from 'express';
import tripRoutes from './tripRoute';
import roundRoutes from './roundRoute';
import busRoutes from './busRoute';
import passengerRoutes from './passengerRoute';

const router = Router();

router.use(tripRoutes);
router.use(roundRoutes);
router.use(busRoutes);
router.use(passengerRoutes);

export default router;