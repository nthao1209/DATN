import { Router } from 'express';
import { unlockRequestController } from '../controllers/unlockRequestController';
import { verifyFirebaseToken } from '../middleware/authMiddleware';

const router = Router();

router.use(verifyFirebaseToken);

// POST approve an unlock request
router.post('/:requestId/approve', unlockRequestController.approve);

// POST reject an unlock request
router.post('/:requestId/reject', unlockRequestController.reject);

export default router;
