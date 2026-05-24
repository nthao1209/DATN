import { Router } from 'express';
import { createTenant, joinTenant } from '../../controllers/tenantController';
import { verifyVerifiedFirebaseTokenOnly } from '../../middleware/authMiddleware';

const router = Router();

router.post('/tenants/create', verifyVerifiedFirebaseTokenOnly, createTenant);
router.post('/tenants/join', verifyVerifiedFirebaseTokenOnly, joinTenant);

export default router;