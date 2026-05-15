"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const passengerController_1 = require("../controllers/passengerController");
const router = (0, express_1.Router)();
console.log('Passenger routes loaded');
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});
// Passenger thuộc Bus
router.get('/trips/:tripId/passengers', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.getAll);
router.post('/trips/:tripId/passengers', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.create);
router.post('/trips/:tripId/passengers/import-sheets', authMiddleware_1.verifyFirebaseToken, upload.single('file'), passengerController_1.passengerController.getImportSheets);
router.post('/trips/:tripId/passengers/import-preview', authMiddleware_1.verifyFirebaseToken, upload.single('file'), passengerController_1.passengerController.importPreview);
// CRUD theo id
router.put('/passengers/:id', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.update);
router.delete('/passengers/:id', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.delete);
exports.default = router;
