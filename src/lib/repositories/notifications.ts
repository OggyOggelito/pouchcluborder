import { prisma } from "@/lib/db";

/**
 * Minimal in-app notifications.
 *
 * There was no notification service in the app before this, and nothing here
 * can send email or push — no mail transport, no web-push keys, no worker. So
 * this is in-app only, which is what the brief asks for at minimum. Adding
 * email later means a sender reading the same rows.
 */
export type NotificationView = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/** Internal links only — a notification must not send staff off-site. */
function safeLink(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function notifyUsers(input: {
  userIds: string[];
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
}): Promise<number> {
  const userIds = [...new Set(input.userIds)].filter(Boolean);
  if (userIds.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkUrl: safeLink(input.linkUrl),
    })),
  });
  return result.count;
}

/** Everyone with access to any of these stores — the usual audience. */
export async function userIdsForStores(storeIds: string[]): Promise<string[]> {
  if (storeIds.length === 0) return [];
  const rows = await prisma.storeAccess.findMany({
    where: { storeId: { in: storeIds } },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}

export async function listNotifications(userId: string, limit = 50): Promise<NotificationView[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      linkUrl: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
