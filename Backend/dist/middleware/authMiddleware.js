"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFirebaseToken = exports.verifyVerifiedFirebaseTokenOnly = exports.verifyFirebaseTokenOnly = void 0;
const firebaseAdmin_1 = __importDefault(require("../config/firebaseAdmin"));
const db_1 = require("../config/db");
const getOrCreatePrismaUser = async (token) => {
    console.time('verifyIdToken');
    const decodedToken = await firebaseAdmin_1.default
        .auth()
        .verifyIdToken(token, false);
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
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({
            message: 'No token provided',
        });
    }
    try {
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
        req.user = user;
        req.firebaseUser = decodedToken;
        return next();
    }
    catch (error) {
        console.error('verifyFirebaseTokenOnly error:', error);
        return res.status(401).json({
            message: 'Unauthorized',
        });
    }
};
exports.verifyFirebaseTokenOnly = verifyFirebaseTokenOnly;
const verifyVerifiedFirebaseTokenOnly = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({
            message: 'No token provided',
        });
    }
    try {
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
        if (rejectUnverifiedEmail(res, decodedToken)) {
            return;
        }
        req.user = user;
        req.firebaseUser = decodedToken;
        return next();
    }
    catch (error) {
        console.error('verifyVerifiedFirebaseTokenOnly error:', error);
        return res.status(401).json({
            message: 'Unauthorized',
        });
    }
};
exports.verifyVerifiedFirebaseTokenOnly = verifyVerifiedFirebaseTokenOnly;
const verifyFirebaseToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({
            message: 'No token provided',
        });
    }
    try {
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
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
        console.error('verifyFirebaseToken error:', error);
        return res.status(401).json({
            message: 'Unauthorized',
        });
    }
};
exports.verifyFirebaseToken = verifyFirebaseToken;
