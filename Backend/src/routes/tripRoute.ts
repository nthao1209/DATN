import { Router } from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import { tripController } from '../controllers/tripController';
const router = Router();

router.get('/trips', verifyFirebaseToken, tripController.getAll);
router.post('/trips', verifyFirebaseToken, tripController.create);
router.put('/trips/:id', verifyFirebaseToken, tripController.update);
router.delete('/trips/:id', verifyFirebaseToken, tripController.delete);

export default router;