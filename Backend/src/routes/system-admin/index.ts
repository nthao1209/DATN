import { Router } from 'express';
import userRoutes from './userRoute';
import roleRoutes from './roleRoute';

const router = Router();

router.use(userRoutes);
router.use(roleRoutes);

export default router;