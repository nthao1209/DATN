import { Response, NextFunction } from 'express';
import admin from '../config/firebaseAdmin';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types/auth';

const prisma = new PrismaClient();

/**
 * Hàm bổ trợ: Xác thực Firebase Token và đảm bảo User tồn tại trong Prisma DB
 */
const getOrCreatePrismaUser = async (token: string) => {
  const decodedToken = await admin.auth().verifyIdToken(token);
  
  // 1️⃣ Thử tìm user theo firebaseUid (primary lookup)
  let user = await prisma.user.findUnique({
    where: { firebaseUid: decodedToken.uid },
  });
  
  // 2️⃣ Nếu không tìm được, thử tìm theo email (fallback lookup)
  if (!user && decodedToken.email) {
    user = await prisma.user.findUnique({
      where: { email: decodedToken.email },
    });
  }
  
  // 3️⃣ Nếu vẫn không tìm được, tạo user mới
  if (!user) {
    user = await prisma.user.create({
      data: {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
        latestData: new Date(),
      },
    });
  } else {
    // 4️⃣ Nếu user tồn tại, cập nhật firebaseUid và thông tin mới từ Firebase
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || user.name, // Giữ tên cũ nếu Firebase không cấp
        latestData: new Date(),
      },
    });
  }

  return { user, decodedToken };
};

const rejectUnverifiedEmail = (res: Response, decodedToken: any) => {
  if (decodedToken.email_verified !== true) {
    res.status(403).json({
      message: 'Email chưa được xác thực',
      code: 'EMAIL_NOT_VERIFIED'
    });
    return true;
  }

  return false;
};

export const verifyFirebaseTokenOnly = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const { user, decodedToken } = await getOrCreatePrismaUser(token);

    req.user = user; 
    req.firebaseUser = decodedToken;

    next();
  } catch (error: any) {
    console.error('Auth Error:', error.message);
    res.status(401).json({ message: 'Unauthorized' });
  }
};

export const verifyVerifiedFirebaseTokenOnly = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const { user, decodedToken } = await getOrCreatePrismaUser(token);

    if (rejectUnverifiedEmail(res, decodedToken)) {
      return;
    }

    req.user = user;
    req.firebaseUser = decodedToken;

    next();
  } catch (error: any) {
    console.error('Auth Error:', error.message);
    res.status(401).json({ message: 'Unauthorized' });
  }
};

export const verifyFirebaseToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const { user, decodedToken } = await getOrCreatePrismaUser(token);

    if (rejectUnverifiedEmail(res, decodedToken)) {
      return;
    }

    // Tìm thông tin Tenant của User này
    const userTenant = await prisma.userTenant.findFirst({
      where: { userId: user.id },
      include: { 
        tenant: true,
        role: true // Lấy luôn Role để sau này check req.role === 'ADMIN'
      }
    });

    if (!userTenant) {
      return res.status(403).json({ 
        message: 'User has no tenant', 
        code: 'NO_TENANT_ASSIGNED' 
      });
    }

    req.user = user; 
    req.firebaseUser = decodedToken;
    req.tenantId = userTenant.tenantId ?? undefined;
    req.roleId = userTenant.roleId;

    next();
  } catch (error: any) {
    console.error('Business Auth Error:', error.message);
    res.status(401).json({ message: 'Unauthorized' });
  }
};