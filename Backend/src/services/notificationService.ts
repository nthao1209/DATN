import { Prisma, PrismaClient } from '@prisma/client';

export type NotificationPayload = Prisma.InputJsonValue | null;

type NotificationWriteClient = Pick<PrismaClient, 'notification'>;

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
