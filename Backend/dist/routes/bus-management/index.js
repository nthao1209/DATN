"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transactionRoute_1 = __importDefault(require("./transactionRoute"));
const unlockRequestRoute_1 = __importDefault(require("./unlockRequestRoute"));
const router = (0, express_1.Router)();
router.use(transactionRoute_1.default);
router.use('/unlock-requests', unlockRequestRoute_1.default);
exports.default = router;
