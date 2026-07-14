import { Prisma, PrismaClient } from '@prisma/client';

export type NotificationPayload = Prisma.InputJsonValue | null;

type NotificationWriteClient = Pick<PrismaClient, 'notification'>;

export interface NotificationCreateInput {
  userId: number;
  tenantId: number;
  type: string;
  title: string;
  content: string;
  payload?: NotificationPayload;
}

export const createNotification = (prisma: NotificationWriteClient, input: NotificationCreateInput) => {
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

export const getTenantAdminRecipient = async (
  prisma: PrismaClient,
  tenantId: number,
  roleIds: number[] = [2],
) => {
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
