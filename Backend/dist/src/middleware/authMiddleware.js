"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFirebaseToken = exports.verifyVerifiedFirebaseTokenOnly = exports.verifyFirebaseTokenOnly = void 0;
const firebaseAdmin_1 = __importDefault(require("../config/firebaseAdmin"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Hàm bổ trợ: Xác thực Firebase Token và đảm bảo User tồn tại trong Prisma DB
 */
const getOrCreatePrismaUser = async (token) => {
    const decodedToken = await firebaseAdmin_1.default.auth().verifyIdToken(token);
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
    }
    else {
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
const rejectUnverifiedEmail = (res, decodedToken) => {
    if (decodedToken.email_verified !== true) {
        res.status(403).json({
            message: 'Email chưa được xác thực',
            code: 'EMAIL_NOT_VERIFIED'
        });
        return true;
    }
    return false;
};
const verifyFirebaseTokenOnly = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token)
        return res.status(401).json({ message: 'No token provided' });
    try {
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
        req.user = user;
        req.firebaseUser = decodedToken;
        next();
    }
    catch (error) {
        console.error('Auth Error:', error.message);
        res.status(401).json({ message: 'Unauthorized' });
    }
};
exports.verifyFirebaseTokenOnly = verifyFirebaseTokenOnly;
const verifyVerifiedFirebaseTokenOnly = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token)
        return res.status(401).json({ message: 'No token provided' });
    try {
        const { user, decodedToken } = await getOrCreatePrismaUser(token);
        if (rejectUnverifiedEmail(res, decodedToken)) {
            return;
        }
        req.user = user;
        req.firebaseUser = decodedToken;
        next();
    }
    catch (error) {
        console.error('Auth Error:', error.message);
        res.status(401).json({ message: 'Unauthorized' });
    }
};
exports.verifyVerifiedFirebaseTokenOnly = verifyVerifiedFirebaseTokenOnly;
const verifyFirebaseToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token)
        return res.status(401).json({ message: 'No token provided' });
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
    }
    catch (error) {
        console.error('Business Auth Error:', error.message);
        res.status(401).json({ message: 'Unauthorized' });
    }
};
exports.verifyFirebaseToken = verifyFirebaseToken;
