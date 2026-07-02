import { Response, NextFunction } from 'express';
import admin from '../config/firebaseAdmin';
import { AuthRequest } from '../types/auth';
import { prisma } from '../config/db';

const readBearerToken = (req: AuthRequest) => {
  const rawAuth = req.headers.authorization;
  const hasBearer = Boolean(rawAuth?.startsWith('Bearer '));
  const token = hasBearer ? rawAuth?.slice(7) : '';

  return token;
};

// Xác thực Firebase token, sau đó tìm hoặc tạo user tương ứng trong database nội bộ.
const getOrCreatePrismaUser = async (token: string) => {
  const decodedToken = await admin
    .auth()
    .verifyIdToken(token, true);

  if (!decodedToken.uid) {
    throw new Error('Invalid Firebase token');
  }

  let user = await prisma.user.findUnique({
    where: {
      firebaseUid: decodedToken.uid,
    },
  });

  if (!user && decodedToken.email) {
    user = await prisma.user.findUnique({
      where: {
        email: decodedToken.email,
      },
    });
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
        name:
          decodedToken.name ||
          decodedToken.email?.split('@')[0] ||
          'User',
        latestData: new Date(),
      },
    });
  }



  return {
    user,
    decodedToken,
  };
};

// Chặn tài khoản bị vô hiệu hóa trước khi request đi vào controller.
const rejectDisabledUser = (
  res: Response,
  user: NonNullable<Awaited<ReturnType<typeof getOrCreatePrismaUser>>['user']>
) => {
  if (user.isDisabled) {
    res.status(403).json({
      message: 'Tài khoản đã bị vô hiệu hóa',
      code: 'ACCOUNT_DISABLED',
    });

    return true;
  }

  return false;
};

// Một số route yêu cầu email Firebase đã verify, ví dụ các luồng sau đăng ký.
const rejectUnverifiedEmail = (
  res: Response,
  decodedToken: any
) => {
  if (decodedToken.email_verified !== true) {
    res.status(403).json({
      message: 'Email chưa được xác thực',
      code: 'EMAIL_NOT_VERIFIED',
    });

    return true;
  }

  return false;
};

export const verifyFirebaseTokenOnly = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Chỉ cần token Firebase hợp lệ; không bắt buộc email verified hay tenant.
  const token = readBearerToken(req);

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const { user, decodedToken } =
      await getOrCreatePrismaUser(token);

    if (rejectDisabledUser(res, user)) {
      return;
    }

    req.user = user;
    req.firebaseUser = decodedToken;

    return next();
  } catch (error: any) {
    return res.status(401).json({
      message: 'Không có quyền truy cập',
    });
  }
};

export const verifyVerifiedFirebaseTokenOnly = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Dùng cho route cần user thật sự xác minh email nhưng chưa cần tenant.
  const token = readBearerToken(req);

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const { user, decodedToken } =
      await getOrCreatePrismaUser(token);

    if (rejectDisabledUser(res, user)) {
      return;
    }

    if (rejectUnverifiedEmail(res, decodedToken)) {
      return;
    }

    req.user = user;
    req.firebaseUser = decodedToken;

    return next();
  } catch (error: any) {
    return res.status(401).json({
      message: 'Không có quyền truy cập',
    });
  }
};

export const verifyFirebaseToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Middleware chính cho các route nghiệp vụ: token hợp lệ, email verified, có tenant và role.
  const token = readBearerToken(req);

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const { user, decodedToken } =
      await getOrCreatePrismaUser(token);

    if (rejectDisabledUser(res, user)) {
      return;
    }

    if (rejectUnverifiedEmail(res, decodedToken)) {
      return;
    }

    const selectedTenantId = Number(req.header('x-tenant-id') || 0);
    const userTenant = await prisma.userTenant.findFirst({
      where: {
        userId: user.id,
        ...(selectedTenantId ? { tenantId: selectedTenantId } : {}),
      },
      include: {
        tenant: true,
        role: true,
      },
    });

    if (!userTenant) {
      return res.status(403).json({
        message: 'User has no tenant',
        code: 'NO_TENANT_ASSIGNED',
      });
    }

    req.user = user;
    req.firebaseUser = decodedToken;
    req.tenantId =
      userTenant.tenantId ?? undefined;
    req.roleId = userTenant.roleId;

    return next();
  } catch (error: any) {
    return res.status(401).json({
      message: 'Không có quyền truy cập',
    });
  }
};
