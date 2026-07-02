"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleController = void 0;
const db_1 = require("../config/db");
const getSystemSuperAdminEmails = () => {
    const fromSingle = (process.env.SUPERADMIN_EMAIL || '').trim();
    const fromList = (process.env.SUPERADMIN_EMAILS || '').trim();
    return `${fromSingle},${fromList}`
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
};
const isSuperAdmin = (req) => {
    const superAdminEmails = getSystemSuperAdminEmails();
    return !!req.user?.email && superAdminEmails.includes(req.user.email.toLowerCase());
};
exports.roleController = {
    getAll: async (_req, res) => {
        try {
            const roles = await db_1.prisma.role.findMany({
                orderBy: { id: 'asc' }
            });
            res.json(roles);
        }
        catch (error) {
            res.status(500).json({ message: 'Lỗi hệ thống', detail: error?.message });
        }
    },
    create: async (req, res) => {
        try {
            if (!isSuperAdmin(req)) {
                return res.status(403).json({ message: 'Từ chối truy cập. Chỉ dành cho SuperAdmin.' });
            }
            const name = String(req.body?.name ?? '').trim();
            const description = String(req.body?.description ?? '').trim();
            if (!name) {
                return res.status(400).json({ message: 'Thiếu tên vai trò' });
            }
            const role = await db_1.prisma.role.create({
                data: {
                    name,
                    description: description || null
                }
            });
            res.status(201).json(role);
        }
        catch (error) {
            res.status(500).json({ message: 'Lỗi hệ thống', detail: error?.message });
        }
    },
    update: async (req, res) => {
        try {
            if (!isSuperAdmin(req)) {
                return res.status(403).json({ message: 'Từ chối truy cập. Chỉ dành cho SuperAdmin.' });
            }
            const roleId = Number(req.params.id);
            if (!roleId) {
                return res.status(400).json({ message: 'ID vai trò không hợp lệ' });
            }
            const name = req.body?.name;
            const description = req.body?.description;
            const updated = await db_1.prisma.role.update({
                where: { id: roleId },
                data: {
                    ...(name !== undefined ? { name: String(name).trim() } : {}),
                    ...(description !== undefined ? { description: description ? String(description).trim() : null } : {})
                }
            });
            res.json(updated);
        }
        catch (error) {
            res.status(500).json({ message: 'Lỗi hệ thống', detail: error?.message });
        }
    },
    delete: async (req, res) => {
        try {
            if (!isSuperAdmin(req)) {
                return res.status(403).json({ message: 'Từ chối truy cập. Chỉ dành cho SuperAdmin.' });
            }
            const roleId = Number(req.params.id);
            if (!roleId) {
                return res.status(400).json({ message: 'ID vai trò không hợp lệ' });
            }
            const usageCount = await db_1.prisma.userTenant.count({ where: { roleId } });
            if (usageCount > 0) {
                return res.status(400).json({ message: 'Vai trò đang được sử dụng và không thể xóa' });
            }
            await db_1.prisma.role.delete({ where: { id: roleId } });
            res.json({ message: 'Đã xóa thành công' });
        }
        catch (error) {
            res.status(500).json({ message: 'Lỗi hệ thống', detail: error?.message });
        }
    }
};
