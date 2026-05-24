import { Router } from 'express';
import { unlockRequestController } from '../../controllers/unlockRequestController';
import { verifyFirebaseToken } from '../../middleware/authMiddleware';

const router = Router();

router.use(verifyFirebaseToken);

router.get('/pending', unlockRequestController.getPendingRequests);
router.post('/bus/:busId/round/:roundId', unlockRequestController.create);
router.post('/:requestId/approve', unlockRequestController.approve);
router.post('/:requestId/reject', unlockRequestController.reject);

export default router;