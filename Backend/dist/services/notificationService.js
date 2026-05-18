"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantNotificationRecipients = exports.createNotificationsForUsers = exports.createNotification = void 0;
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
const createNotificationsForUsers = async (prisma, userIds, input) => {
    const uniqueUserIds = Array.from(new Set(userIds)).filter((userId) => Number.isInteger(userId) && userId > 0);
    if (!uniqueUserIds.length) {
        return [];
    }
    return prisma.$transaction(uniqueUserIds.map((userId) => prisma.notification.create({
        data: {
            userId,
            type: input.type,
            title: input.title,
            content: input.content,
            ...(input.payload === null ? {} : { payload: input.payload }),
        },
    })));
};
exports.createNotificationsForUsers = createNotificationsForUsers;
const getTenantNotificationRecipients = async (prisma, tenantId) => {
    const rows = await prisma.userTenant.findMany({
        where: {
            tenantId,
            roleId: {
                in: [1, 2, 3],
            },
        },
        select: { userId: true },
    });
    return rows.map((row) => row.userId);
};
exports.getTenantNotificationRecipients = getTenantNotificationRecipients;
