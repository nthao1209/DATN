"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renameCurrentTenant = exports.joinTenant = exports.createTenant = exports.generateUniqueJoinCode = exports.generateJoinCode = void 0;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const generateJoinCode = () => {
    // Bỏ các ký tự dễ nhầm như I/O/0/1 để người dùng nhập mã mời ít sai hơn.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = (0, crypto_1.randomBytes)(6);
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += alphabet[bytes[i] % alphabet.length];
    }
    return code;
};
exports.generateJoinCode = generateJoinCode;
const generateUniqueJoinCode = async () => {
    // Sinh lại mã cho tới khi không trùng tenant nào trong database.
    let code;
    let exists = true;
    while (exists) {
        code = (0, exports.generateJoinCode)();
        const tenant = await db_1.prisma.tenant.findUnique({
            where: { joinCode: code },
        });
        if (!tenant)
            exists = false;
    }
    return code;
};
exports.generateUniqueJoinCode = generateUniqueJoinCode;
const createTenant = async (req, res) => {
    // Người tạo tổ chức được gán role Admin trong chính tenant vừa tạo.
    const user = req.user;
    const { name } = req.body;
    if (!user) {
        return res.status(401).json({ message: "Không có quyền truy cập" });
    }
    if (!name) {
        return res.status(400).json({ message: "Thiếu tên tổ chức" });
    }
    try {
        const joinCode = await (0, exports.generateUniqueJoinCode)();
        const tenant = await db_1.prisma.tenant.create({
            data: {
                name,
                joinCode,
            },
        });
        await db_1.prisma.userTenant.create({
            data: {
                userId: user.id,
                tenantId: tenant.id,
                roleId: 2,
            },
        });
        return res.json({
            message: "Tạo tổ chức thành công",
            tenant: {
                ...tenant,
                joinCode: joinCode
            },
            joinCode: joinCode
        });
    }
    catch (err) {
        return res.status(500).json({ message: "Lỗi server" });
    }
};
exports.createTenant = createTenant;
const joinTenant = async (req, res) => {
    // Tham gia bằng mã mời và mặc định nhận role trưởng xe/quản lý xe.
    const { joinCode } = req.body;
    const user = req.user;
    if (!user)
        return res.status(401).json({ message: "Không xác định được người dùng" });
    const normalizedJoinCode = String(joinCode || '').trim().toUpperCase();
    try {
        const tenant = await db_1.prisma.tenant.findUnique({
            where: { joinCode: normalizedJoinCode }
        });
        if (!tenant)
            return res.status(400).json({ message: "Không tìm thấy thông tin" });
        await db_1.prisma.userTenant.create({
            data: {
                userId: user.id,
                tenantId: tenant.id,
                roleId: 3
            }
        });
        res.json({ message: "Thành công", tenant });
    }
    catch (error) {
        res.status(400).json({ message: "Bạn đã là thành viên của tổ chức này" });
    }
};
exports.joinTenant = joinTenant;
const canRenameTenant = (req, res) => {
    if (!req.user?.id) {
        res.status(401).json({ message: 'Không có quyền truy cập' });
        return false;
    }
    if (!req.tenantId) {
        res.status(401).json({ message: 'Không có quyền truy cập' });
        return false;
    }
    if (Number(req.roleId) !== 2) {
        res.status(403).json({ message: 'Chỉ admin của tổ chức mới được đổi tên' });
        return false;
    }
    return true;
};
const renameCurrentTenant = async (req, res) => {
    try {
        if (!canRenameTenant(req, res))
            return;
        const name = String(req.body?.name || '').trim();
        if (!name) {
            return res.status(400).json({ message: 'Thiếu tên tổ chức' });
        }
        const tenant = await db_1.prisma.tenant.update({
            where: { id: req.tenantId },
            data: { name },
        });
        return res.json({
            message: 'Đổi tên tổ chức thành công',
            tenant,
        });
    }
    catch (error) {
        return res.status(500).json({ message: 'Lỗi server', detail: error?.message });
    }
};
exports.renameCurrentTenant = renameCurrentTenant;
