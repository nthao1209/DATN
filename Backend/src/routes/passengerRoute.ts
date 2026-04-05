import { Router } from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import { passengerController } from '../controllers/passengerController';

const router = Router();

// Passenger thuộc Bus
router.get('/trips/:tripId/passengers', verifyFirebaseToken, passengerController.getAll);
router.post('/trips/:tripId/passengers', verifyFirebaseToken, passengerController.create);

// CRUD theo id
router.put('/passengers/:id', verifyFirebaseToken, passengerController.update);
router.delete('/passengers/:id', verifyFirebaseToken, passengerController.delete);

export default router;