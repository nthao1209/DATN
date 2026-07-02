"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFirebaseToken = exports.verifyVerifiedFirebaseTokenOnly = exports.verifyFirebaseTokenOnly = void 0;
const firebaseAdmin_1 = __importDefault(require("../config/firebaseAdmin"));
const db_1 = require("../config/db");
const readBearerToken = (req) => {
    const rawAuth = req.headers.authorization;
    const hasBearer = Boolean(rawAuth?.startsWith('Bearer '));
    const token = hasBearer ? rawAuth?.slice(7) : '';
    return token;
};
// Xác thực Firebase token, sau đó tìm hoặc tạo user tương ứng trong database nội bộ.
const getOrCreatePrismaUser = async (token) => {
    const decodedToken = await firebaseAdmin_1.default
        .auth()
        .verifyIdToken(token, true);
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
// Chặn tài khoản bị vô hiệu hóa trước khi request đi vào controller.
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
// Một số route yêu cầu email Firebase đã verify, ví dụ các luồng sau đăng ký.
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
    // Chỉ cần token Firebase hợp lệ; không bắt buộc email verified hay tenant.
    const token = readBearerToken(req);
    if (!token) {
        return res.status(401).json({
            message: 'No token provided',
        });
    }
    try {
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
        if (rejectDisabledUser(res, user)) {
            return;
        }
        req.user = user;
        req.firebaseUser = decodedToken;
        return next();
    }
    catch (error) {
        return res.status(401).json({
            message: 'Không có quyền truy cập',
        });
    }
};
exports.verifyFirebaseTokenOnly = verifyFirebaseTokenOnly;
const verifyVerifiedFirebaseTokenOnly = async (req, res, next) => {
    // Dùng cho route cần user thật sự xác minh email nhưng chưa cần tenant.
    const token = readBearerToken(req);
    if (!token) {
        return res.status(401).json({
            message: 'No token provided',
        });
    }
    try {
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
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
        return res.status(401).json({
            message: 'Không có quyền truy cập',
        });
    }
};
exports.verifyVerifiedFirebaseTokenOnly = verifyVerifiedFirebaseTokenOnly;
const verifyFirebaseToken = async (req, res, next) => {
    // Middleware chính cho các route nghiệp vụ: token hợp lệ, email verified, có tenant và role.
    const token = readBearerToken(req);
    if (!token) {
        return res.status(401).json({
            message: 'No token provided',
        });
    }
    try {
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
        if (rejectDisabledUser(res, user)) {
            return;
        }
        if (rejectUnverifiedEmail(res, decodedToken)) {
            return;
        }
        const selectedTenantId = Number(req.header('x-tenant-id') || 0);
        const userTenant = await db_1.prisma.userTenant.findFirst({
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
    }
    catch (error) {
        return res.status(401).json({
            message: 'Không có quyền truy cập',
        });
    }
};
exports.verifyFirebaseToken = verifyFirebaseToken;
