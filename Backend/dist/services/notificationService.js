"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantAdminRecipient = exports.createNotification = void 0;
const createNotification = (prisma, input) => {
    return prisma.notification.create({
        data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            content: input.content,
            ...(input.payload === null ? {} : { payload: input.payload }),
        },
    });
};
exports.createNotification = createNotification;
const getTenantAdminRecipient = async (prisma, tenantId, roleIds = [2]) => {
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
