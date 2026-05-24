import { Router } from 'express';
import authRoutes from './authRoute';
import tenantRoutes from './tenantRoute';
import notificationRoutes from './notificationRoute';

const router = Router();

router.use(authRoutes);
router.use(tenantRoutes);
router.use(notificationRoutes);

export default router;