"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tripRoute_1 = __importDefault(require("./tripRoute"));
const roundRoute_1 = __importDefault(require("./roundRoute"));
const busRoute_1 = __importDefault(require("./busRoute"));
const passengerRoute_1 = __importDefault(require("./passengerRoute"));
const router = (0, express_1.Router)();
router.use(tripRoute_1.default);
router.use(roundRoute_1.default);
router.use(busRoute_1.default);
router.use(passengerRoute_1.default);
exports.default = router;
