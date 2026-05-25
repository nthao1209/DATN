"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinTenant = exports.createTenant = exports.generateUniqueJoinCode = exports.generateJoinCode = void 0;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const generateJoinCode = () => {
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
    const user = req.user;
    const { name } = req.body;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
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
        console.error(err);
        return res.status(500).json({ message: "Lỗi server" });
    }
};
exports.createTenant = createTenant;
const joinTenant = async (req, res) => {
    const { joinCode } = req.body;
    const user = req.user;
    if (!user)
        return res.status(401).json({ message: "User not identified" });
    try {
        const tenant = await db_1.prisma.tenant.findUnique({
            where: { joinCode }
        });
        if (!tenant)
            return res.status(400).json({ message: "Not information" });
        const membership = await db_1.prisma.userTenant.create({
            data: {
                userId: user.id,
                tenantId: tenant.id,
                roleId: 3
            }
        });
        res.json({ message: "Succesful", tenant });
    }
    catch (error) {
        res.status(400).json({ message: "Bạn đã là thành viên của tổ chức này" });
    }
};
exports.joinTenant = joinTenant;
