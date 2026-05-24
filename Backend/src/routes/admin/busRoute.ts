import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/authMiddleware';
import { busController } from '../../controllers/busController';

const router = Router();

router.get('/trips/:tripId/buses', verifyFirebaseToken, busController.getAll);
router.post('/trips/:tripId/buses', verifyFirebaseToken, busController.create);
router.get('/busManagers', verifyFirebaseToken, busController.getBusManagers);
router.put('/buses/:id', verifyFirebaseToken, busController.update);
router.delete('/buses/:id', verifyFirebaseToken, busController.delete);
router.get('/bus-round-status', verifyFirebaseToken, busController.getRoundStatuses);
router.post('/buses/:busId/rounds/:roundId/confirm-checks', verifyFirebaseToken, busController.confirmChecks);

export default router;