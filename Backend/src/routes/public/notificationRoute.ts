import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/authMiddleware';
import { notificationController } from '../../controllers/notificationController';

const router = Router();

router.use(verifyFirebaseToken);

router.get('/notifications', notificationController.list);
router.post('/notifications', notificationController.create);
router.patch('/notifications/read-all', notificationController.markAllRead);
router.patch('/notifications/:id/read', notificationController.markRead);
router.delete('/notifications/:id', notificationController.remove);
router.delete('/notifications', notificationController.removeAll);

export default router;