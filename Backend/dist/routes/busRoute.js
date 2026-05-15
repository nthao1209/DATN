"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const busController_1 = require("../controllers/busController");
const router = (0, express_1.Router)();
//  Bus thuộc Trip
router.get('/trips/:tripId/buses', authMiddleware_1.verifyFirebaseToken, busController_1.busController.getAll);
router.post('/trips/:tripId/buses', authMiddleware_1.verifyFirebaseToken, busController_1.busController.create);
router.get('/busManagers', authMiddleware_1.verifyFirebaseToken, busController_1.busController.getBusManagers);
//  CRUD theo id
router.put('/buses/:id', authMiddleware_1.verifyFirebaseToken, busController_1.busController.update);
router.delete('/buses/:id', authMiddleware_1.verifyFirebaseToken, busController_1.busController.delete);
// Confirm (lock) check-in/check-out for a specific bus & round
router.get('/bus-round-status', authMiddleware_1.verifyFirebaseToken, busController_1.busController.getRoundStatuses);
router.post('/buses/:busId/rounds/:roundId/confirm-checks', authMiddleware_1.verifyFirebaseToken, busController_1.busController.confirmChecks);
exports.default = router;
