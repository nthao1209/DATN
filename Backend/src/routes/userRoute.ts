import { Router } from 'express';
import { verifyFirebaseTokenOnly } from '../middleware/authMiddleware';
import { userController } from '../controllers/userController';

const router = Router();

router.get('/users', verifyFirebaseTokenOnly, userController.getAll);
router.put('/users/:id', verifyFirebaseTokenOnly, userController.update);
router.delete('/users/:id', verifyFirebaseTokenOnly, userController.removeFromTenant);

export default router;
