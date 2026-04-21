import { Router } from 'express';
import { verifyVerifiedFirebaseTokenOnly } from '../middleware/authMiddleware';
import { roleController } from '../controllers/roleController';

const router = Router();

router.get('/roles', verifyVerifiedFirebaseTokenOnly, roleController.getAll);
router.post('/roles', verifyVerifiedFirebaseTokenOnly, roleController.create);
router.put('/roles/:id', verifyVerifiedFirebaseTokenOnly, roleController.update);
router.delete('/roles/:id', verifyVerifiedFirebaseTokenOnly, roleController.delete);

export default router;
