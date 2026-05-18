"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const tenantRoute_1 = __importDefault(require("./routes/tenantRoute"));
const authRoute_1 = __importDefault(require("./routes/authRoute"));
const tripRoute_1 = __importDefault(require("./routes/tripRoute"));
const roundRoute_1 = __importDefault(require("./routes/roundRoute"));
const busRoute_1 = __importDefault(require("./routes/busRoute"));
const passengerRoute_1 = __importDefault(require("./routes/passengerRoute"));
const userRoute_1 = __importDefault(require("./routes/userRoute"));
const roleRoute_1 = __importDefault(require("./routes/roleRoute"));
const transactionRoute_1 = __importDefault(require("./routes/transactionRoute"));
const unlockRequestRoute_1 = __importDefault(require("./routes/unlockRequestRoute"));
const notificationRoute_1 = __importDefault(require("./routes/notificationRoute"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api', tenantRoute_1.default);
app.use('/api', authRoute_1.default);
app.use('/api', tripRoute_1.default);
app.use('/api', roundRoute_1.default);
app.use('/api', busRoute_1.default);
app.use('/api', passengerRoute_1.default);
app.use('/api', userRoute_1.default);
app.use('/api', roleRoute_1.default);
app.use('/api', transactionRoute_1.default);
app.use('/api/unlock-requests', unlockRequestRoute_1.default);
app.use('/api', notificationRoute_1.default);
// Debug: list registered routes (temporary)
app.get('/api/_routes', (_req, res) => {
    try {
        // @ts-ignore: access express internals for debugging
        const routes = app._router.stack
            .filter((layer) => layer.route)
            .map((layer) => {
            const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
            return `${methods} ${layer.route.path}`;
        });
        res.json({ routes });
    }
    catch (err) {
        res.status(500).json({ message: 'Failed to enumerate routes' });
    }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
