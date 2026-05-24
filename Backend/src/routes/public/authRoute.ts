import { Router } from 'express';
import { syncUser, getMyStatus, deleteUser } from '../../controllers/authController';
import { verifyFirebaseTokenOnly, verifyVerifiedFirebaseTokenOnly, verifyFirebaseToken } from '../../middleware/authMiddleware';

const router = Router();

router.post('/auth/sync', verifyFirebaseTokenOnly, syncUser);
router.get('/auth/status', verifyVerifiedFirebaseTokenOnly, getMyStatus);
router.delete('/auth/delete-account', verifyFirebaseToken, deleteUser);

export default router;