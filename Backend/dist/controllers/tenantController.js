"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendJoinCodeToEmail = exports.joinTenant = exports.createTenant = exports.generateUniqueJoinCode = exports.generateJoinCode = void 0;
const client_1 = require("@prisma/client");
const nanoid_1 = require("nanoid");
const emailService_1 = require("../services/emailService");
const prisma = new client_1.PrismaClient();
const generateJoinCode = () => {
    return (0, nanoid_1.nanoid)(6);
};
exports.generateJoinCode = generateJoinCode;
const generateUniqueJoinCode = async () => {
    let code;
    let exists = true;
    while (exists) {
        code = (0, exports.generateJoinCode)();
        const tenant = await prisma.tenant.findUnique({
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
        const tenant = await prisma.tenant.create({
            data: {
                name,
                joinCode,
            },
        });
        await prisma.userTenant.create({
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
        const tenant = await prisma.tenant.findUnique({
            where: { joinCode }
        });
        if (!tenant)
            return res.status(400).json({ message: "Not information" });
        const membership = await prisma.userTenant.create({
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
const sendJoinCodeToEmail = async (req, res) => {
    const { tenantId, email } = req.body;
    const user = req.user;
    if (!user)
        return res.status(401).json({ message: "Unauthorized" });
    if (!tenantId || !email) {
        return res.status(400).json({ message: "Thiếu thông tin" });
    }
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });
        if (!tenant) {
            return res.status(404).json({ message: "Tổ chức không tồn tại" });
        }
        // Kiểm tra xem user có phải là owner/admin của tổ chức
        const userTenant = await prisma.userTenant.findUnique({
            where: {
                userId_tenantId: {
                    userId: user.id,
                    tenantId: tenantId
                }
            },
            include: { role: true }
        });
        if (!userTenant || userTenant.role.name !== 'owner') {
            return res.status(403).json({ message: "Bạn không có quyền thực hiện hành động này" });
        }
        // Gửi email với mã tham gia
        await (0, emailService_1.sendJoinCodeEmail)(email, tenant.joinCode, tenant.name);
        res.json({
            message: "Mã tham gia đã được gửi vào email",
            joinCode: tenant.joinCode
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server" });
    }
};
exports.sendJoinCodeToEmail = sendJoinCodeToEmail;
