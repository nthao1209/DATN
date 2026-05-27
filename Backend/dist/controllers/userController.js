"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
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
const isSystemSuperAdmin = (req) => {
    const superAdminEmails = getSystemSuperAdminEmails();
    return !!req.user?.email && superAdminEmails.includes(req.user.email.toLowerCase());
};
const requireSystemSuperAdmin = (req, res) => {
    if (!req.user?.id) {
        res.status(401).json({ message: 'Unauthorized' });
        return false;
    }
    if (!isSystemSuperAdmin(req)) {
        res.status(403).json({ message: 'Forbidden. SuperAdmin only.' });
        return false;
    }
    return true;
};
exports.userController = {
    getAll: async (req, res) => {
        try {
            if (!requireSystemSuperAdmin(req, res))
                return;
            const users = await db_1.prisma.user.findMany({
                include: {
                    userTenants: {
                        include: {
                            role: true,
                            tenant: true
                        }
                    }
                },
                orderBy: { createdDate: 'desc' }
            });
            const superAdminEmails = getSystemSuperAdminEmails();
            const normalizedUsers = users.map((user) => ({
                ...user,
                latestRole: superAdminEmails.includes((user.email || '').toLowerCase())
                    ? 'system_admin'
                    : (user.userTenants?.[0]?.role?.name || 'N/A'),
                lastAccessAt: user.latestData || null,
            }));
            res.json(normalizedUsers);
        }
        catch (error) {
            console.error('get users error:', error);
            res.status(500).json({ message: 'Server error', detail: error?.message });
        }
    },
    update: async (req, res) => {
        try {
            if (!requireSystemSuperAdmin(req, res))
                return;
            const userId = Number(req.params.id);
            if (!userId) {
                return res.status(400).json({ message: 'Invalid user id' });
            }
            const { name, description, roleId } = req.body;
            const updatedUser = await db_1.prisma.user.update({
                where: { id: userId },
                data: {
                    ...(name !== undefined ? { name: String(name).trim() } : {}),
                    ...(description !== undefined ? { description: description ? String(description).trim() : null } : {})
                }
            });
            if (roleId !== undefined && roleId !== null) {
                const nextRoleId = Number(roleId);
                if (!nextRoleId) {
                    return res.status(400).json({ message: 'Invalid roleId' });
                }
                const tenantIdFromBody = Number(req.body?.tenantId || 0);
                if (!tenantIdFromBody) {
                    return res.status(400).json({ message: 'tenantId is required when updating roleId' });
                }
                const membership = await db_1.prisma.userTenant.findUnique({
                    where: {
                        userId_tenantId: {
                            userId,
                            tenantId: tenantIdFromBody
                        }
                    }
                });
                if (!membership) {
                    return res.status(404).json({ message: 'User membership not found for tenant' });
                }
                await db_1.prisma.userTenant.update({ where: { id: membership.id }, data: { roleId: nextRoleId } });
            }
            res.json(updatedUser);
        }
        catch (error) {
            console.error('update user error:', error);
            res.status(500).json({ message: 'Server error', detail: error?.message });
        }
    },
    removeFromTenant: async (req, res) => {
        try {
            if (!requireSystemSuperAdmin(req, res))
                return;
            const userId = Number(req.params.id);
            if (!userId) {
                return res.status(400).json({ message: 'Invalid user id' });
            }
            await db_1.prisma.userTenant.deleteMany({ where: { userId } });
            const memberships = await db_1.prisma.userTenant.count({ where: { userId } });
            if (memberships === 0) {
                await db_1.prisma.user.delete({ where: { id: userId } });
            }
            res.json({ message: 'User removed from tenant successfully' });
        }
        catch (error) {
            console.error('delete user error:', error);
            res.status(500).json({ message: 'Server error', detail: error?.message });
        }
    },
    setStatus: async (req, res) => {
        try {
            if (!requireSystemSuperAdmin(req, res))
                return;
            const userId = Number(req.params.id);
            if (!userId) {
                return res.status(400).json({ message: 'Invalid user id' });
            }
            const { isDisabled } = req.body;
            if (typeof isDisabled !== 'boolean') {
                return res.status(400).json({ message: 'isDisabled (boolean) is required' });
            }
            const updateData = {
                isDisabled,
                disabledAt: isDisabled ? new Date() : null,
            };
            const updated = await db_1.prisma.user.update({ where: { id: userId }, data: updateData });
            // Try to sync with Firebase Auth (best-effort)
            try {
                if (updated.firebaseUid) {
                    await firebaseAdmin_1.default.auth().updateUser(updated.firebaseUid, { disabled: !!isDisabled });
                    if (isDisabled) {
                        await firebaseAdmin_1.default.auth().revokeRefreshTokens(updated.firebaseUid);
                    }
                }
            }
            catch (fbErr) {
                console.warn('Failed to sync user disabled state to Firebase:', fbErr);
            }
            res.json(updated);
        }
        catch (error) {
            console.error('set user status error:', error);
            res.status(500).json({ message: 'Server error', detail: error?.message });
        }
    }
};
