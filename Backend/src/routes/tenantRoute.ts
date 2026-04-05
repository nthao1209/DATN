import {Router} from 'express'
import { createTenant,joinTenant, sendJoinCodeToEmail } from '../controllers/tenantController'
import { verifyFirebaseTokenOnly } from '../middleware/authMiddleware'

const router = Router ();

router.post('/tenants/create', verifyFirebaseTokenOnly, createTenant);
router.post('/tenants/join', verifyFirebaseTokenOnly, joinTenant);
router.post('/tenants/send-join-code', verifyFirebaseTokenOnly, sendJoinCodeToEmail);

export default router;