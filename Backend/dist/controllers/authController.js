"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.getMyStatus = exports.syncUser = void 0;
const client_1 = require("@prisma/client");
const firebaseAdmin_1 = __importDefault(require("../config/firebaseAdmin"));
const prisma = new client_1.PrismaClient();
const syncUser = async (req, res) => {
    const { email, firebaseUid, name } = req.body;
    try {
        const user = await prisma.user.upsert({
            where: { firebaseUid: firebaseUid },
            update: { email, name },
            create: {
                email,
                name,
                firebaseUid,
            },
        });
        return res.status(200).json(user);
    }
    catch (error) {
        return res.status(500).json({ error: "Không thể đồng bộ User" });
    }
};
exports.syncUser = syncUser;
const getMyStatus = async (req, res) => {
    const userId = req.user?.id;
    const userTenants = await prisma.userTenant.findMany({
        where: { userId },
        include: {
            tenant: true,
            role: true
        }
    });
    res.json({
        user: req.user,
        tenants: userTenants.map(ut => ({
            ...ut.tenant,
            role: ut.role.name
        }))
    });
};
exports.getMyStatus = getMyStatus;
const deleteUser = async (req, res) => {
    const userId = req.user?.id;
    const firebaseUid = req.user?.firebaseUid;
    if (!userId || !firebaseUid) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        await firebaseAdmin_1.default.auth().deleteUser(firebaseUid);
        console.log(`Đã xóa user Firebase: ${firebaseUid}`);
        await prisma.userTenant.deleteMany({
            where: { userId }
        });
        await prisma.user.delete({
            where: { id: userId }
        });
        res.json({
            message: "Tài khoản đã được xóa thành công"
        });
    }
    catch (error) {
        console.error("Lỗi xóa user:", error);
        res.status(500).json({ message: "Lỗi server khi xóa tài khoản" });
    }
};
exports.deleteUser = deleteUser;
