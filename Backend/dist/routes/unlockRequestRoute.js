"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const unlockRequestController_1 = require("../controllers/unlockRequestController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.verifyFirebaseToken);
// POST create an unlock request
router.post('/bus/:busId/round/:roundId', unlockRequestController_1.unlockRequestController.create);
// POST approve an unlock request
router.post('/:requestId/approve', unlockRequestController_1.unlockRequestController.approve);
// POST reject an unlock request
router.post('/:requestId/reject', unlockRequestController_1.unlockRequestController.reject);
exports.default = router;
