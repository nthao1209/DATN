import { Router } from 'express';
import { createTenant, joinTenant, renameCurrentTenant } from '../../controllers/tenantController';
import { verifyVerifiedFirebaseTokenOnly } from '../../middleware/authMiddleware';
import { verifyFirebaseToken } from '../../middleware/authMiddleware';

const router = Router();

router.post('/tenants/create', verifyVerifiedFirebaseTokenOnly, createTenant);
router.post('/tenants/join', verifyVerifiedFirebaseTokenOnly, joinTenant);
router.put('/tenants/current', verifyFirebaseToken, renameCurrentTenant);

export default router;