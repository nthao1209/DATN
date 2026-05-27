import {prisma} from "../config/db";
import { AuthRequest } from "../types/auth";
import { Response } from "express";
import admin from "../config/firebaseAdmin";


const getSystemSuperAdminEmails = () => {
  const fromSingle = (process.env.SUPERADMIN_EMAIL || '').trim();
  const fromList = (process.env.SUPERADMIN_EMAILS || '').trim();

  return `${fromSingle},${fromList}`
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};


export const syncUser = async (req: AuthRequest, res: Response) => {
  const { email, firebaseUid, name } = req.body;

  if (!email || !firebaseUid) {
    return res.status(400).json({ error: "Thiếu email hoặc firebaseUid" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const user = await prisma.user.upsert({
      where: { firebaseUid: String(firebaseUid) },
      update: { email: normalizedEmail, name },
      create: { email: normalizedEmail, name, firebaseUid: String(firebaseUid) },
    });

    const isSystemSuperAdmin =
      getSystemSuperAdminEmails().includes(normalizedEmail) ||
      getSystemSuperAdminEmails().includes(String(firebaseUid));

    if (isSystemSuperAdmin) {
      await prisma.userTenant.deleteMany({
        where: { userId: user.id, tenantId: null },
      });
      await prisma.userTenant.create({
        data: { userId: user.id, tenantId: null, roleId: 1 },
      });
      await admin.auth().updateUser(String(firebaseUid), { emailVerified: true });
    }

    return res.status(200).json(user);
  } catch {
    return res.status(500).json({ error: "Không thể đồng bộ User" });
  }
};

export const getMyStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: 'Unauthorized',
      });
    }

    const isSystemSuperAdmin =
      (!!req.user?.email &&
        getSystemSuperAdminEmails().includes(
          req.user.email.toLowerCase()
        )) ||
      (!!req.user?.firebaseUid &&
        getSystemSuperAdminEmails().includes(
          req.user.firebaseUid
        ));

    const userTenants = await prisma.userTenant.findMany({
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
          ...ut.tenant!,
          roleId: ut.roleId,
          role: {
            id: ut.role.id,
            name: ut.role.name,
            description: ut.role.description ?? undefined,
          },
        })),
    });
  } catch (error) {


    return res.status(500).json({
      message: 'Internal server error',
    });
  }
};

export const deleteUser = async (
  req: AuthRequest,
  res: Response
) => {
  const userId = req.user?.id;
  const firebaseUid = req.user?.firebaseUid;

  if (!userId || !firebaseUid) {
    return res.status(401).json({
      message: 'Unauthorized',
    });
  }

  try {
    const existingUser = await prisma.user.findUnique({
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
      await prisma.user.update({
        where: { id: userId },
        data: {
          isDisabled: true,
          disabledAt: new Date(),
        },
      });
    }



    // Vô hiệu hóa và revoke Firebase để chặn token cũ ở phía Firebase
    try {
      await admin.auth().updateUser(firebaseUid, {
        disabled: true,
      });
      await admin.auth().revokeRefreshTokens(firebaseUid);

    } catch (fbErr: any) {

    }

    return res.json({ message: 'Tài khoản đã bị vô hiệu hóa thành công' });
  } catch (error: any) {


    return res.status(500).json({
      message: 'Lỗi server khi vô hiệu hóa tài khoản',
      error: error.message,
    });
  }
};