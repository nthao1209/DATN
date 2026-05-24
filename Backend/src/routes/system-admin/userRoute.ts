import { Router } from 'express';
import { verifyVerifiedFirebaseTokenOnly } from '../../middleware/authMiddleware';
import { userController } from '../../controllers/userController';

const router = Router();

router.get('/users', verifyVerifiedFirebaseTokenOnly, userController.getAll);
router.put('/users/:id', verifyVerifiedFirebaseTokenOnly, userController.update);
router.delete('/users/:id', verifyVerifiedFirebaseTokenOnly, userController.removeFromTenant);

export default router;