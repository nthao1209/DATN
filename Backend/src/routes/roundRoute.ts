import { Router } from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import { roundController } from '../controllers/roundController';
const router = Router();

router.get('/trips/:tripId/rounds', verifyFirebaseToken, roundController.getAll);
router.post('/trips/:tripId/rounds', verifyFirebaseToken, roundController.create);
router.put('/rounds/:id', verifyFirebaseToken, roundController.update);
router.delete('/rounds/:id', verifyFirebaseToken, roundController.delete);

export default router;