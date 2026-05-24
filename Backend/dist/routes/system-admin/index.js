"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userRoute_1 = __importDefault(require("./userRoute"));
const roleRoute_1 = __importDefault(require("./roleRoute"));
const router = (0, express_1.Router)();
router.use(userRoute_1.default);
router.use(roleRoute_1.default);
exports.default = router;
