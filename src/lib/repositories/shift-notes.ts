import { prisma } from "@/lib/db";
import {
  archiveCutoff,
  clampNoteText,
  sortNotes,
  toNoteCategory,
  type NoteCategory,
} from "@/lib/shift-notes";

export type NoteView = {
  id: string;
  storeId: string;
  storeName: string;
  text: string;
  category: NoteCategory;
  pinned: boolean;
  authorName: string | null;
  resolvedAt: Date | null;
  resolvedByName: string | null;
  archivedAt: Date | null;
  createdAt: Date;
};

const NOTE_SELECT = {
  id: true,
  storeId: true,
  text: true,
  category: true,
  pinned: true,
  resolvedAt: true,
  archivedAt: true,
  createdAt: true,
  store: { select: { name: true } },
  author: { select: { name: true, email: true } },
  resolvedBy: { select: { name: true, email: true } },
} as const;

type RawNote = {
  id: string;
  storeId: string;
  text: string;
  category: string;
  pinned: boolean;
  resolvedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  store: { name: string };
  author: { name: string | null; email: string } | null;
  resolvedBy: { name: string | null; email: string } | null;
};

/** First name only where we have one — a feed reads better than an email list. */
function display(person: { name: string | null; email: string } | null): string | null {
  if (!person) return null;
  return person.name?.trim() || person.email;
}

function toView(note: RawNote): NoteView {
  return {
    id: note.id,
    storeId: note.storeId,
    storeName: note.store.name,
    text: note.text,
    category: toNoteCategory(note.category),
    pinned: note.pinned,
    authorName: display(note.author),
    resolvedAt: note.resolvedAt,
    resolvedByName: display(note.resolvedBy),
    archivedAt: note.archivedAt,
    createdAt: note.createdAt,
  };
}

/**
 * The feed, or the archive.
 *
 * `storeIds` is the scope and comes from the caller's StoreAccess — an empty
 * list returns nothing rather than everything, which is what a user with no
 * store should see.
 *
 * The age cutoff is applied in SQL for the feed so an old store's history does
 * not have to be loaded to be discarded; pinned notes are exempt via the OR.
 */
export async function listNotes(input: {
  storeIds: string[];
  archived: boolean;
  now?: Date;
  limit?: number;
}): Promise<NoteView[]> {
  if (input.storeIds.length === 0) return [];

  const cutoff = archiveCutoff(input.now ?? new Date());

  const where = input.archived
    ? {
        storeId: { in: input.storeIds },
        OR: [
          { archivedAt: { not: null } },
          { AND: [{ pinned: false }, { createdAt: { lt: cutoff } }] },
        ],
      }
    : {
        storeId: { in: input.storeIds },
        archivedAt: null,
        OR: [{ pinned: true }, { createdAt: { gte: cutoff } }],
      };

  const rows = await prisma.shiftNote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 200,
    select: NOTE_SELECT,
  });

  // Ordering lives in shift-notes.ts so the rule is tested once and used
  // everywhere, rather than being an orderBy the tests cannot see.
  return sortNotes((rows as RawNote[]).map(toView));
}

/** The home-screen card: the latest few, feed order. */
export async function latestNotes(storeIds: string[], limit = 3): Promise<NoteView[]> {
  const notes = await listNotes({ storeIds, archived: false, limit: 50 });
  return notes.slice(0, limit);
}

export async function countOpenTodos(storeIds: string[]): Promise<number> {
  if (storeIds.length === 0) return 0;
  return prisma.shiftNote.count({
    where: {
      storeId: { in: storeIds },
      category: "TODO",
      resolvedAt: null,
      archivedAt: null,
    },
  });
}

export async function createNote(input: {
  storeId: string;
  authorId: string;
  text: string;
  category: NoteCategory;
}): Promise<string> {
  const text = clampNoteText(input.text);
  if (!text) throw new Error("A note needs some text.");

  const note = await prisma.shiftNote.create({
    data: {
      storeId: input.storeId,
      authorId: input.authorId,
      text,
      category: input.category,
      // An IMPORTANT note is pinned on creation, which is what "stays at the
      // top until someone archives it" means in practice.
      pinned: input.category === "IMPORTANT",
    },
    select: { id: true },
  });
  return note.id;
}

export async function getNote(
  id: string
): Promise<{ id: string; storeId: string; resolvedAt: Date | null; category: string } | null> {
  if (!id) return null;
  return prisma.shiftNote.findUnique({
    where: { id },
    select: { id: true, storeId: true, resolvedAt: true, category: true },
  });
}

/**
 * Ticks a TODO off, or un-ticks it.
 *
 * Who ticked it and when are recorded together, so an un-tick clears both —
 * a resolvedBy with no resolvedAt would be a half-truth in the feed.
 */
export async function setTodoResolved(input: {
  id: string;
  resolved: boolean;
  userId: string;
}): Promise<void> {
  await prisma.shiftNote.update({
    where: { id: input.id },
    data: input.resolved
      ? { resolvedAt: new Date(), resolvedById: input.userId }
      : { resolvedAt: null, resolvedById: null },
  });
}

/** Archiving unpins: a pinned note would otherwise never leave the feed. */
export async function archiveNote(id: string): Promise<void> {
  await prisma.shiftNote.update({
    where: { id },
    data: { archivedAt: new Date(), pinned: false },
  });
}

export async function unarchiveNote(id: string): Promise<void> {
  await prisma.shiftNote.update({ where: { id }, data: { archivedAt: null } });
}

/** ADMIN only, enforced in the action. The one hard delete in the feature. */
export async function deleteNote(id: string): Promise<void> {
  await prisma.shiftNote.delete({ where: { id } });
}

/** Everyone else with access to this store — the audience for an IMPORTANT note. */
export async function otherUserIdsForStore(
  storeId: string,
  excludeUserId: string
): Promise<string[]> {
  const rows = await prisma.storeAccess.findMany({
    where: { storeId, NOT: { userId: excludeUserId } },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}
