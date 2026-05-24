"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenantController_1 = require("../../controllers/tenantController");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.post('/tenants/create', authMiddleware_1.verifyVerifiedFirebaseTokenOnly, tenantController_1.createTenant);
router.post('/tenants/join', authMiddleware_1.verifyVerifiedFirebaseTokenOnly, tenantController_1.joinTenant);
exports.default = router;
