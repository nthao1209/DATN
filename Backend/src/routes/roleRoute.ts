import { Router } from 'express';
import { verifyFirebaseTokenOnly } from '../middleware/authMiddleware';
import { roleController } from '../controllers/roleController';

const router = Router();

router.get('/roles', verifyFirebaseTokenOnly, roleController.getAll);
router.post('/roles', verifyFirebaseTokenOnly, roleController.create);
router.put('/roles/:id', verifyFirebaseTokenOnly, roleController.update);
router.delete('/roles/:id', verifyFirebaseTokenOnly, roleController.delete);

export default router;
