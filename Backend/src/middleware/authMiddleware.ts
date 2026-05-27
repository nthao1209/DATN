import { Response, NextFunction } from 'express';
import admin from '../config/firebaseAdmin';
import { AuthRequest } from '../types/auth';
import { prisma } from '../config/db';

const logVerifyAttempt = (label: string, req: AuthRequest) => {
  const rawAuth = req.headers.authorization;
  const hasBearer = Boolean(rawAuth?.startsWith('Bearer '));
  const token = hasBearer ? rawAuth?.slice(7) : '';

  console.log(`[authMiddleware] ${label} verifyToken start`, {
    method: req.method,
    path: req.originalUrl,
    hasAuthorizationHeader: Boolean(rawAuth),
    hasBearer,
    tokenProvided: Boolean(token),
    tokenLength: token?.length || 0,
  });

  return token;
};

const getOrCreatePrismaUser = async (token: string) => {
  console.time('verifyIdToken');

  const decodedToken = await admin
    .auth()
    .verifyIdToken(token, true);

  console.timeEnd('verifyIdToken');

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
  const token = logVerifyAttempt('verifyFirebaseTokenOnly', req);

  if (!token) {
    console.warn('[authMiddleware] verifyFirebaseTokenOnly no token provided', {
      method: req.method,
      path: req.originalUrl,
    });

    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const { user, decodedToken } =
      await getOrCreatePrismaUser(token);

    console.log('[authMiddleware] verifyFirebaseTokenOnly success', {
      method: req.method,
      path: req.originalUrl,
      userId: user.id,
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
    });

    if (rejectDisabledUser(res, user)) {
      return;
    }

    req.user = user;
    req.firebaseUser = decodedToken;

    return next();
  } catch (error: any) {
    console.error(
      '[authMiddleware] verifyFirebaseTokenOnly failed:',
      error
    );

    return res.status(401).json({
      message: 'Unauthorized',
    });
  }
};

export const verifyVerifiedFirebaseTokenOnly = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = logVerifyAttempt('verifyVerifiedFirebaseTokenOnly', req);

  if (!token) {
    console.warn('[authMiddleware] verifyVerifiedFirebaseTokenOnly no token provided', {
      method: req.method,
      path: req.originalUrl,
    });

    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const { user, decodedToken } =
      await getOrCreatePrismaUser(token);

    console.log('[authMiddleware] verifyVerifiedFirebaseTokenOnly success', {
      method: req.method,
      path: req.originalUrl,
      userId: user.id,
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    });

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
    console.error(
      '[authMiddleware] verifyVerifiedFirebaseTokenOnly failed:',
      error
    );

    return res.status(401).json({
      message: 'Unauthorized',
    });
  }
};

export const verifyFirebaseToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = logVerifyAttempt('verifyFirebaseToken', req);

  if (!token) {
    console.warn('[authMiddleware] verifyFirebaseToken no token provided', {
      method: req.method,
      path: req.originalUrl,
    });

    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const { user, decodedToken } =
      await getOrCreatePrismaUser(token);

    console.log('[authMiddleware] verifyFirebaseToken success', {
      method: req.method,
      path: req.originalUrl,
      userId: user.id,
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    });

    if (rejectDisabledUser(res, user)) {
      return;
    }

    if (rejectUnverifiedEmail(res, decodedToken)) {
      return;
    }

    const userTenant =
      await prisma.userTenant.findFirst({
        where: {
          userId: user.id,
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
    console.error(
      '[authMiddleware] verifyFirebaseToken failed:',
      error
    );

    return res.status(401).json({
      message: 'Unauthorized',
    });
  }
};