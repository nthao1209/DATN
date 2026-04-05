import { Router } from "express";
import { syncUser, getMyStatus, deleteUser } from "../controllers/authController";
import { verifyFirebaseTokenOnly, verifyFirebaseToken } from "../middleware/authMiddleware";

const router = Router();

router.post('/auth/sync', verifyFirebaseTokenOnly, syncUser);
router.get('/auth/status', verifyFirebaseTokenOnly, getMyStatus);
router.delete('/auth/delete-account', verifyFirebaseToken, deleteUser);

export default router;
