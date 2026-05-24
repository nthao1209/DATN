"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const public_1 = __importDefault(require("./routes/public"));
const admin_1 = __importDefault(require("./routes/admin"));
const system_admin_1 = __importDefault(require("./routes/system-admin"));
const bus_management_1 = __importDefault(require("./routes/bus-management"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api', public_1.default);
app.use('/api', admin_1.default);
app.use('/api', system_admin_1.default);
app.use('/api', bus_management_1.default);
app.get("/health", (req, res) => {
    res.status(200).send("ok");
});
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
