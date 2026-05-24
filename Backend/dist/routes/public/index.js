"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authRoute_1 = __importDefault(require("./authRoute"));
const tenantRoute_1 = __importDefault(require("./tenantRoute"));
const notificationRoute_1 = __importDefault(require("./notificationRoute"));
const router = (0, express_1.Router)();
router.use(authRoute_1.default);
router.use(tenantRoute_1.default);
router.use(notificationRoute_1.default);
exports.default = router;
