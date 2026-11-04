/**
 * Shift notes — "what the next shift needs to know".
 *
 * A feed per store. Nothing here is a task tracker: a note is a sentence left
 * for whoever comes in next, and the only state it carries is whether a TODO
 * has been ticked off.
 */

export const NOTE_CATEGORIES = ["INFO", "IMPORTANT", "TODO"] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  INFO: "Info",
  IMPORTANT: "Viktigt",
  TODO: "Att göra",
};

export const NOTE_CATEGORY_HELP: Record<NoteCategory, string> = {
  INFO: "Bra att veta för nästa skift.",
  IMPORTANT: "Ligger kvar högst upp tills någon ansvarig arkiverar den.",
  TODO: "Något som ska göras — bockas av när det är klart.",
};

/** Long enough for a handover, short enough that nobody writes an essay. */
export const MAX_NOTE_LENGTH = 1000;

/**
 * How long a note stays in the main feed.
 *
 * Named rather than inlined because both the feed query and the archive tab
 * depend on it being the same number.
 */
export const ARCHIVE_AFTER_DAYS = 30;

export function isNoteCategory(value: unknown): value is NoteCategory {
  return typeof value === "string" && (NOTE_CATEGORIES as readonly string[]).includes(value);
}

/** Unknown values become a plain note rather than being rejected. */
export function toNoteCategory(value: unknown): NoteCategory {
  return isNoteCategory(value) ? value : "INFO";
}

export function clampNoteText(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().slice(0, MAX_NOTE_LENGTH);
}

/** The cutoff the feed and the archive split on. */
export function archiveCutoff(now: Date): Date {
  return new Date(now.getTime() - ARCHIVE_AFTER_DAYS * 86_400_000);
}

export type NoteLike = {
  category: NoteCategory;
  pinned: boolean;
  archivedAt: Date | null;
  createdAt: Date;
};

/**
 * Whether a note belongs in the "Arkiv" tab rather than the feed.
 *
 * Three ways in, and the order matters: an explicit archive by an OWNER or
 * ADMIN wins over everything, a pinned note never ages out, and otherwise it
 * is simply age. IMPORTANT notes are not exempt from age on their own — they
 * stay at the *top* of the feed, which is sorting, not lifetime. Pinning is
 * what keeps one around indefinitely.
 */
export function isArchived(note: NoteLike, now: Date): boolean {
  if (note.archivedAt) return true;
  if (note.pinned) return false;
  return note.createdAt < archiveCutoff(now);
}

/**
 * Feed order: IMPORTANT and pinned notes first, then newest.
 *
 * An unresolved IMPORTANT note is the reason this feed exists, so it outranks
 * a newer INFO note. Within a tier it is plain reverse-chronological.
 */
export function noteRank(note: NoteLike): number {
  if (note.pinned) return 0;
  if (note.category === "IMPORTANT") return 1;
  return 2;
}

export function sortNotes<T extends NoteLike>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    const byRank = noteRank(a) - noteRank(b);
    if (byRank !== 0) return byRank;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** An open TODO: a TODO note nobody has ticked off and nobody has archived. */
export function isOpenTodo(note: NoteLike & { resolvedAt: Date | null }): boolean {
  return note.category === "TODO" && note.resolvedAt === null && note.archivedAt === null;
}
