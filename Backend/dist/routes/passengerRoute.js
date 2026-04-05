"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const passengerController_1 = require("../controllers/passengerController");
const router = (0, express_1.Router)();
// Passenger thuộc Bus
router.get('/trips/:tripId/passengers', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.getAll);
router.post('/trips/:tripId/passengers', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.create);
// CRUD theo id
router.put('/passengers/:id', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.update);
router.delete('/passengers/:id', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.delete);
exports.default = router;
