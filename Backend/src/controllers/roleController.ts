import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { prisma } from '../config/db';

const getSystemSuperAdminEmails = () => {
  const fromSingle = (process.env.SUPERADMIN_EMAIL || '').trim();
  const fromList = (process.env.SUPERADMIN_EMAILS || '').trim();

  return `${fromSingle},${fromList}`
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

const isSuperAdmin = (req: AuthRequest) => {
  const superAdminEmails = getSystemSuperAdminEmails();
  return !!req.user?.email && superAdminEmails.includes(req.user.email.toLowerCase());
};

export const roleController = {
  getAll: async (_req: AuthRequest, res: Response) => {
    try {
      const roles = await prisma.role.findMany({
        orderBy: { id: 'asc' }
      });
      res.json(roles);
    } catch (error: any) {
      console.error('get roles error:', error);
      res.status(500).json({ message: 'Server error', detail: error?.message });
    }
  },

  create: async (req: AuthRequest, res: Response) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden. SuperAdmin only.' });
      }

      const name = String(req.body?.name ?? '').trim();
      const description = String(req.body?.description ?? '').trim();

      if (!name) {
        return res.status(400).json({ message: 'Role name is required' });
      }

      const role = await prisma.role.create({
        data: {
          name,
          description: description || null
        }
      });

      res.status(201).json(role);
    } catch (error: any) {
      console.error('create role error:', error);
      res.status(500).json({ message: 'Server error', detail: error?.message });
    }
  },

  update: async (req: AuthRequest, res: Response) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden. SuperAdmin only.' });
      }

      const roleId = Number(req.params.id);
      if (!roleId) {
        return res.status(400).json({ message: 'Invalid role id' });
      }

      const name = req.body?.name;
      const description = req.body?.description;

      const updated = await prisma.role.update({
        where: { id: roleId },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(description !== undefined ? { description: description ? String(description).trim() : null } : {})
        }
      });

      res.json(updated);
    } catch (error: any) {
      console.error('update role error:', error);
      res.status(500).json({ message: 'Server error', detail: error?.message });
    }
  },

  delete: async (req: AuthRequest, res: Response) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden. SuperAdmin only.' });
      }

      const roleId = Number(req.params.id);
      if (!roleId) {
        return res.status(400).json({ message: 'Invalid role id' });
      }

      const usageCount = await prisma.userTenant.count({ where: { roleId } });
      if (usageCount > 0) {
        return res.status(400).json({ message: 'Role is in use and cannot be deleted' });
      }

      await prisma.role.delete({ where: { id: roleId } });
      res.json({ message: 'Deleted successfully' });
    } catch (error: any) {
      console.error('delete role error:', error);
      res.status(500).json({ message: 'Server error', detail: error?.message });
    }
  }
};
