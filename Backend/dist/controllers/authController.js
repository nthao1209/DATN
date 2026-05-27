"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.getMyStatus = exports.syncUser = void 0;
const db_1 = require("../config/db");
const firebaseAdmin_1 = __importDefault(require("../config/firebaseAdmin"));
const getSystemSuperAdminEmails = () => {
    const fromSingle = (process.env.SUPERADMIN_EMAIL || '').trim();
    const fromList = (process.env.SUPERADMIN_EMAILS || '').trim();
    return `${fromSingle},${fromList}`
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
};
const syncUser = async (req, res) => {
    const { email, firebaseUid, name } = req.body;
    if (!email || !firebaseUid) {
        return res.status(400).json({ error: "Thiếu email hoặc firebaseUid" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
        const user = await db_1.prisma.user.upsert({
            where: { firebaseUid: String(firebaseUid) },
            update: { email: normalizedEmail, name },
            create: { email: normalizedEmail, name, firebaseUid: String(firebaseUid) },
        });
        const isSystemSuperAdmin = getSystemSuperAdminEmails().includes(normalizedEmail) ||
            getSystemSuperAdminEmails().includes(String(firebaseUid));
        if (isSystemSuperAdmin) {
            await db_1.prisma.userTenant.deleteMany({
                where: { userId: user.id, tenantId: null },
            });
            await db_1.prisma.userTenant.create({
                data: { userId: user.id, tenantId: null, roleId: 1 },
            });
            await firebaseAdmin_1.default.auth().updateUser(String(firebaseUid), { emailVerified: true });
        }
        return res.status(200).json(user);
    }
    catch {
        return res.status(500).json({ error: "Không thể đồng bộ User" });
    }
};
exports.syncUser = syncUser;
const getMyStatus = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                message: 'Unauthorized',
            });
        }
        const isSystemSuperAdmin = (!!req.user?.email &&
            getSystemSuperAdminEmails().includes(req.user.email.toLowerCase())) ||
            (!!req.user?.firebaseUid &&
                getSystemSuperAdminEmails().includes(req.user.firebaseUid));
        const userTenants = await db_1.prisma.userTenant.findMany({
            where: { userId },
            include: {
                tenant: true,
                role: true,
            },
        });
        return res.json({
            user: req.user,
            roleId: isSystemSuperAdmin ? 1 : undefined,
            tenants: userTenants
                .filter((ut) => ut.tenant)
                .map((ut) => ({
                ...ut.tenant,
                roleId: ut.roleId,
                role: {
                    id: ut.role.id,
                    name: ut.role.name,
                    description: ut.role.description ?? undefined,
                },
            })),
        });
    }
    catch (error) {
        console.error('getMyStatus error:', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};
exports.getMyStatus = getMyStatus;
const deleteUser = async (req, res) => {
    const userId = req.user?.id;
    const firebaseUid = req.user?.firebaseUid;
    if (!userId || !firebaseUid) {
        return res.status(401).json({
            message: 'Unauthorized',
        });
    }
    try {
        const existingUser = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                firebaseUid: true,
                isDisabled: true,
            },
        });
        if (!existingUser) {
            return res.status(404).json({
                message: 'Không tìm thấy tài khoản',
            });
        }
        if (!existingUser.isDisabled) {
            await db_1.prisma.user.update({
                where: { id: userId },
                data: {
                    isDisabled: true,
                    disabledAt: new Date(),
                },
            });
        }
        console.log('Database user disabled');
        // Vô hiệu hóa và revoke Firebase để chặn token cũ ở phía Firebase
        try {
            await firebaseAdmin_1.default.auth().updateUser(firebaseUid, {
                disabled: true,
            });
            await firebaseAdmin_1.default.auth().revokeRefreshTokens(firebaseUid);
            console.log('Firebase user disabled and tokens revoked');
        }
        catch (fbErr) {
            console.error('Firebase disable sync failed after DB update:', fbErr);
        }
        return res.json({ message: 'Tài khoản đã bị vô hiệu hóa thành công' });
    }
    catch (error) {
        console.error('Disable user error:', JSON.stringify(error, null, 2));
        return res.status(500).json({
            message: 'Lỗi server khi vô hiệu hóa tài khoản',
            error: error.message,
        });
    }
};
exports.deleteUser = deleteUser;
