import { Router } from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import { busController } from '../controllers/busController';

const router = Router();

//  Bus thuộc Trip
router.get('/trips/:tripId/buses', verifyFirebaseToken, busController.getAll);
router.post('/trips/:tripId/buses', verifyFirebaseToken, busController.create);

router.get('/busManagers', verifyFirebaseToken, busController.getBusManagers);

//  CRUD theo id
router.put('/buses/:id', verifyFirebaseToken, busController.update);
router.delete('/buses/:id', verifyFirebaseToken, busController.delete);

// Confirm (lock) check-in/check-out for a specific bus & round
router.get('/bus-round-status', verifyFirebaseToken, busController.getRoundStatuses);
router.post('/buses/:busId/rounds/:roundId/confirm-checks', verifyFirebaseToken, busController.confirmChecks);

export default router;