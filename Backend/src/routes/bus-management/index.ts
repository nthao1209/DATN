import { Router } from 'express';
import transactionRoutes from './transactionRoute';
import unlockRequestRoutes from './unlockRequestRoute';

const router = Router();

router.use(transactionRoutes);
router.use('/unlock-requests', unlockRequestRoutes);

export default router;