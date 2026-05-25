import { Response, NextFunction } from 'express';
import admin from '../config/firebaseAdmin';
import { AuthRequest } from '../types/auth';
import { prisma } from '../config/db';

const getOrCreatePrismaUser = async (token: string) => {
  console.time('verifyIdToken');

  const decodedToken = await admin
    .auth()
    .verifyIdToken(token, false);

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
  const token =
    req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const { user, decodedToken } =
      await getOrCreatePrismaUser(token);

    req.user = user;
    req.firebaseUser = decodedToken;

    return next();
  } catch (error: any) {
    console.error(
      'verifyFirebaseTokenOnly error:',
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
  const token =
    req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const { user, decodedToken } =
      await getOrCreatePrismaUser(token);

    if (rejectUnverifiedEmail(res, decodedToken)) {
      return;
    }

    req.user = user;
    req.firebaseUser = decodedToken;

    return next();
  } catch (error: any) {
    console.error(
      'verifyVerifiedFirebaseTokenOnly error:',
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
  const token =
    req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const { user, decodedToken } =
      await getOrCreatePrismaUser(token);

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
      'verifyFirebaseToken error:',
      error
    );

    return res.status(401).json({
      message: 'Unauthorized',
    });
  }
};