"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFirebaseToken = exports.verifyVerifiedFirebaseTokenOnly = exports.verifyFirebaseTokenOnly = void 0;
const firebaseAdmin_1 = __importDefault(require("../config/firebaseAdmin"));
const db_1 = require("../config/db");
const logVerifyAttempt = (label, req) => {
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
const getOrCreatePrismaUser = async (token) => {
    console.time('verifyIdToken');
    const decodedToken = await firebaseAdmin_1.default
        .auth()
        .verifyIdToken(token, true);
    console.timeEnd('verifyIdToken');
    if (!decodedToken.uid) {
        throw new Error('Invalid Firebase token');
    }
    let user = await db_1.prisma.user.findUnique({
        where: {
            firebaseUid: decodedToken.uid,
        },
    });
    if (!user && decodedToken.email) {
        user = await db_1.prisma.user.findUnique({
            where: {
                email: decodedToken.email,
            },
        });
    }
    if (!user) {
        user = await db_1.prisma.user.create({
            data: {
                firebaseUid: decodedToken.uid,
                email: decodedToken.email || '',
                name: decodedToken.name ||
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
const rejectDisabledUser = (res, user) => {
    if (user.isDisabled) {
        res.status(403).json({
            message: 'Tài khoản đã bị vô hiệu hóa',
            code: 'ACCOUNT_DISABLED',
        });
        return true;
    }
    return false;
};
const rejectUnverifiedEmail = (res, decodedToken) => {
    if (decodedToken.email_verified !== true) {
        res.status(403).json({
            message: 'Email chưa được xác thực',
            code: 'EMAIL_NOT_VERIFIED',
        });
        return true;
    }
    return false;
};
const verifyFirebaseTokenOnly = async (req, res, next) => {
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
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
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
    }
    catch (error) {
        console.error('[authMiddleware] verifyFirebaseTokenOnly failed:', error);
        return res.status(401).json({
            message: 'Unauthorized',
        });
    }
};
exports.verifyFirebaseTokenOnly = verifyFirebaseTokenOnly;
const verifyVerifiedFirebaseTokenOnly = async (req, res, next) => {
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
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
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
    }
    catch (error) {
        console.error('[authMiddleware] verifyVerifiedFirebaseTokenOnly failed:', error);
        return res.status(401).json({
            message: 'Unauthorized',
        });
    }
};
exports.verifyVerifiedFirebaseTokenOnly = verifyVerifiedFirebaseTokenOnly;
const verifyFirebaseToken = async (req, res, next) => {
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
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
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
        const userTenant = await db_1.prisma.userTenant.findFirst({
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
    }
    catch (error) {
        console.error('[authMiddleware] verifyFirebaseToken failed:', error);
        return res.status(401).json({
            message: 'Unauthorized',
        });
    }
};
exports.verifyFirebaseToken = verifyFirebaseToken;
