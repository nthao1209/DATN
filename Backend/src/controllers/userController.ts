import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { prisma } from '../config/db';
import admin from '../config/firebaseAdmin';

const getSystemSuperAdminEmails = () => {
  const fromSingle = (process.env.SUPERADMIN_EMAIL || '').trim();
  const fromList = (process.env.SUPERADMIN_EMAILS || '').trim();

  return `${fromSingle},${fromList}`
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

const isSystemSuperAdmin = (req: AuthRequest) => {
  const superAdminEmails = getSystemSuperAdminEmails();
  return !!req.user?.email && superAdminEmails.includes(req.user.email.toLowerCase());
};

const requireSystemSuperAdmin = (req: AuthRequest, res: Response): boolean => {
  if (!req.user?.id) {
    res.status(401).json({ message: 'Không có quyền truy cập' });
    return false;
  }

  if (!isSystemSuperAdmin(req)) {
    res.status(403).json({ message: 'Từ chối truy cập. Chỉ dành cho SuperAdmin.' });
    return false;
  }

  return true;
};

export const userController = {
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      if (!requireSystemSuperAdmin(req, res)) return;

      const users = await prisma.user.findMany({
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
    } catch (error: any) {

      res.status(500).json({ message: 'Lỗi hệ thống', detail: error?.message });
    }
  },

  update: async (req: AuthRequest, res: Response) => {
    try {
      if (!requireSystemSuperAdmin(req, res)) return;

      const userId = Number(req.params.id);
      if (!userId) {
        return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
      }

      const { name, description, roleId } = req.body;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(description !== undefined ? { description: description ? String(description).trim() : null } : {})
        }
      });

      if (roleId !== undefined && roleId !== null) {
        const nextRoleId = Number(roleId);
        if (!nextRoleId) {
          return res.status(400).json({ message: 'ID vai trò không hợp lệ' });
        }

        const tenantIdFromBody = Number(req.body?.tenantId || 0);
        if (!tenantIdFromBody) {
          return res.status(400).json({ message: 'Bắt buộc phải có tenantId khi cập nhật vai trò' });
        }

        const membership = await prisma.userTenant.findUnique({
          where: {
            userId_tenantId: {
              userId,
              tenantId: tenantIdFromBody
            }
          }
        });

        if (!membership) {
          return res.status(404).json({ message: 'Không tìm thấy thành viên trong tổ chức' });
        }

        await prisma.userTenant.update({ where: { id: membership.id }, data: { roleId: nextRoleId } });
      }

      res.json(updatedUser);
    } catch (error: any) {

      res.status(500).json({ message: 'Lỗi hệ thống', detail: error?.message });
    }
  },

  removeFromTenant: async (req: AuthRequest, res: Response) => {
    try {
      if (!requireSystemSuperAdmin(req, res)) return;

      const userId = Number(req.params.id);
      if (!userId) {
        return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
      }

      await prisma.userTenant.deleteMany({ where: { userId } });

      const memberships = await prisma.userTenant.count({ where: { userId } });
      if (memberships === 0) {
        await prisma.user.delete({ where: { id: userId } });
      }

      res.json({ message: 'Đã xóa người dùng khỏi tổ chức' });
    } catch (error: any) {

      res.status(500).json({ message: 'Lỗi hệ thống', detail: error?.message });
    }
  },

  setStatus: async (req: AuthRequest, res: Response) => {
    try {
      if (!requireSystemSuperAdmin(req, res)) return;

      const userId = Number(req.params.id);
      if (!userId) {
        return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
      }

      const { isDisabled } = req.body as { isDisabled?: boolean };
      if (typeof isDisabled !== 'boolean') {
        return res.status(400).json({ message: 'isDisabled (boolean) is required' });
      }

      const updateData: any = {
        isDisabled,
        disabledAt: isDisabled ? new Date() : null,
      };

      const updated = await prisma.user.update({ where: { id: userId }, data: updateData });

      // Try to sync with Firebase Auth (best-effort)
      try {
        if (updated.firebaseUid) {
          await admin.auth().updateUser(updated.firebaseUid, { disabled: !!isDisabled });
          if (isDisabled) {
            await admin.auth().revokeRefreshTokens(updated.firebaseUid);
          }
        }
      } catch (fbErr) {

      }

      res.json(updated);
    } catch (error: any) {

      res.status(500).json({ message: 'Lỗi hệ thống', detail: error?.message });
    }
  }
};
