import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/authMiddleware';
import { transactionController } from '../../controllers/transactionController';

const router = Router();

router.get('/transactions', verifyFirebaseToken, transactionController.getAll);
router.post('/transactions', verifyFirebaseToken, transactionController.create);
router.put('/transactions/:id', verifyFirebaseToken, transactionController.update);
router.delete('/transactions/:id', verifyFirebaseToken, transactionController.delete);

export default router;