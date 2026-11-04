import { prisma } from "@/lib/db";

/**
 * Per-user settings. One row, created lazily on first write.
 *
 * Only news read-state lives here so far. It is deliberately a single
 * timestamp rather than per-article read tracking: the badge answers "is there
 * anything I have not seen", and nothing in the app needs a finer answer.
 */
export async function getNewsReadAt(userId: string): Promise<Date | null> {
  const preference = await prisma.userPreference.findUnique({
    where: { userId },
    select: { newsReadAt: true },
  });
  return preference?.newsReadAt ?? null;
}

/** Announcements published since this person last opened /news. */
export async function countUnreadNews(userId: string): Promise<number> {
  const readAt = await getNewsReadAt(userId);

  return prisma.announcement.count({
    where: {
      publishedAt: readAt ? { gt: readAt } : { not: null },
    },
  });
}

export async function markNewsRead(userId: string): Promise<void> {
  const now = new Date();
  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, newsReadAt: now },
    update: { newsReadAt: now },
  });
}
