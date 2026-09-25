import { prisma } from "@/lib/db";
import { toCategory, type AnnouncementCategory } from "@/lib/announcements";

export type AnnouncementRecord = {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  pinned: boolean;
  publishedAt: Date | null;
  authorName: string | null;
  updatedAt: Date;
};

const SELECT = {
  id: true,
  title: true,
  body: true,
  category: true,
  pinned: true,
  publishedAt: true,
  updatedAt: true,
  author: { select: { name: true, email: true } },
} as const;

type Raw = {
  id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  author: { name: string | null; email: string } | null;
};

function toRecord(row: Raw): AnnouncementRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: toCategory(row.category),
    pinned: row.pinned,
    publishedAt: row.publishedAt,
    authorName: row.author?.name ?? row.author?.email ?? null,
    updatedAt: row.updatedAt,
  };
}

/**
 * The staff feed: published only, pinned first, then newest first.
 * Ordering is done in the query so the "2-3 most recent" widget and the full
 * feed cannot disagree about what is most recent.
 */
export async function listPublished(
  category?: AnnouncementCategory,
  limit?: number
): Promise<AnnouncementRecord[]> {
  const rows = await prisma.announcement.findMany({
    where: {
      publishedAt: { not: null, lte: new Date() },
      ...(category ? { category } : {}),
    },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    ...(limit ? { take: limit } : {}),
    select: SELECT,
  });
  return rows.map((row) => toRecord(row as Raw));
}

/** Everything, drafts included — the admin list. */
export async function listAll(): Promise<AnnouncementRecord[]> {
  const rows = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: SELECT,
  });
  return rows.map((row) => toRecord(row as Raw));
}

export async function getAnnouncement(id: string): Promise<AnnouncementRecord | null> {
  const row = await prisma.announcement.findUnique({ where: { id }, select: SELECT });
  return row ? toRecord(row as Raw) : null;
}

export async function createAnnouncement(input: {
  title: string;
  body: string;
  category: AnnouncementCategory;
  pinned: boolean;
  publish: boolean;
  authorId: string;
}): Promise<AnnouncementRecord> {
  const row = await prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      category: input.category,
      pinned: input.pinned,
      publishedAt: input.publish ? new Date() : null,
      authorId: input.authorId,
    },
    select: SELECT,
  });
  return toRecord(row as Raw);
}

export async function updateAnnouncement(
  id: string,
  input: {
    title: string;
    body: string;
    category: AnnouncementCategory;
    pinned: boolean;
    publish: boolean;
  }
): Promise<AnnouncementRecord> {
  const existing = await prisma.announcement.findUnique({
    where: { id },
    select: { publishedAt: true },
  });

  const row = await prisma.announcement.update({
    where: { id },
    data: {
      title: input.title,
      body: input.body,
      category: input.category,
      pinned: input.pinned,
      // Publishing stamps the time once; editing a published item keeps its
      // original date so the feed does not reshuffle on a typo fix.
      publishedAt: input.publish ? (existing?.publishedAt ?? new Date()) : null,
    },
    select: SELECT,
  });
  return toRecord(row as Raw);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await prisma.announcement.delete({ where: { id } });
}
