import { Router } from 'express';
import multer from 'multer';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import { passengerController } from '../controllers/passengerController';

const router = Router();
console.log('Passenger routes loaded');
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 10 * 1024 * 1024 }
});

// Passenger thuộc Bus
router.get('/trips/:tripId/passengers', verifyFirebaseToken, passengerController.getAll);
router.post('/trips/:tripId/passengers', verifyFirebaseToken, passengerController.create);
router.post('/trips/:tripId/passengers/import-sheets', verifyFirebaseToken, upload.single('file'), passengerController.getImportSheets);
router.post('/trips/:tripId/passengers/import-preview', verifyFirebaseToken, upload.single('file'), passengerController.importPreview);

// CRUD theo id
router.put('/passengers/:id', verifyFirebaseToken, passengerController.update);
router.delete('/passengers/:id', verifyFirebaseToken, passengerController.delete);

export default router;