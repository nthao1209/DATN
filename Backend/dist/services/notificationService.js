"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantAdminRecipient = exports.createNotification = void 0;
const createNotification = (prisma, input) => {
    // Ghi notification vào DB; realtime nếu cần sẽ được publish riêng qua MQTT service.
    return prisma.notification.create({
        data: {
            userId: input.userId,
            tenantId: input.tenantId,
            type: input.type,
            title: input.title,
            content: input.content,
            ...(input.payload === null ? {} : { payload: input.payload }),
        },
    });
};
exports.createNotification = createNotification;
const getTenantAdminRecipient = async (prisma, tenantId, roleIds = [2]) => {
    // Chọn một admin của tenant làm người nhận thông báo nghiệp vụ như mở khóa/sai xe.
    // orderBy giúp kết quả ổn định nếu tenant có nhiều admin.
    const recipient = await prisma.userTenant.findFirst({
        where: {
            tenantId,
            roleId: {
                in: roleIds,
            },
        },
        orderBy: {
            userId: 'asc',
        },
        select: { userId: true },
    });
    return recipient?.userId ?? null;
};
exports.getTenantAdminRecipient = getTenantAdminRecipient;
