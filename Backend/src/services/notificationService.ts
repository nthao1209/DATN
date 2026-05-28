import { Prisma, PrismaClient } from '@prisma/client';

export type NotificationPayload = Prisma.InputJsonValue | null;

type NotificationWriteClient = Pick<PrismaClient, 'notification'>;
type NotificationBatchClient = NotificationWriteClient & Pick<PrismaClient, '$transaction'>;

export interface NotificationCreateInput {
  userId: number;
  type: string;
  title: string;
  content: string;
  payload?: NotificationPayload;
}

export const createNotification = (prisma: NotificationWriteClient, input: NotificationCreateInput) => {
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

export const createNotificationsForUsers = async (
  prisma: NotificationBatchClient,
  userIds: number[],
  input: Omit<NotificationCreateInput, 'userId'>,
) => {
  const uniqueUserIds = Array.from(new Set(userIds)).filter((userId) => Number.isInteger(userId) && userId > 0);

  if (!uniqueUserIds.length) {
    return [];
  }

  return prisma.$transaction(
    uniqueUserIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type: input.type,
          title: input.title,
          content: input.content,
          ...(input.payload === null ? {} : { payload: input.payload }),
        },
      }),
    ),
  );
};

export const getTenantAdminRecipient = async (
  prisma: PrismaClient,
  tenantId: number,
  roleIds: number[] = [2],
) => {
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

export const getTenantNotificationRecipients = async (
  prisma: PrismaClient,
  tenantId: number,
  roleIds: number[] = [1, 2, 3],
) => {
  const rows = await prisma.userTenant.findMany({
    where: {
      tenantId,
      roleId: {
        in: roleIds,
      },
    },
    select: { userId: true },
  });

  return rows.map((row) => row.userId);
};
