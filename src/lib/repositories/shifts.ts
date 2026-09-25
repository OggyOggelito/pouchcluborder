import { prisma } from "@/lib/db";
import { dateOnly, type ParsedShift } from "@/lib/schedule/import";

export type ShiftImportResult = {
  created: number;
  replaced: number;
  unknownEmails: string[];
  unknownStores: string[];
  skipped: number;
  from: string | null;
  to: string | null;
};

/**
 * Writes parsed shifts into our own database.
 *
 * Re-importing the same period replaces it rather than duplicating: every shift
 * for the matched people inside the file's own date range is cleared first.
 * That keeps repeated uploads of a corrected roster idempotent, which matters
 * because the cadence of these exports is whatever the scheduling tool gives us.
 */
export async function importShifts(
  parsed: ParsedShift[],
  source: string
): Promise<ShiftImportResult> {
  const result: ShiftImportResult = {
    created: 0,
    replaced: 0,
    unknownEmails: [],
    unknownStores: [],
    skipped: 0,
    from: null,
    to: null,
  };

  if (parsed.length === 0) return result;

  const [users, stores] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true } }),
    prisma.store.findMany({ select: { id: true, name: true, slug: true } }),
  ]);

  const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id]));

  // Stores are matched on name or slug, case-insensitively, because a
  // scheduling export writes the location however a human typed it.
  const storeByKey = new Map<string, string>();
  for (const store of stores) {
    storeByKey.set(store.name.toLowerCase(), store.id);
    storeByKey.set(store.slug.toLowerCase(), store.id);
  }

  const unknownEmails = new Set<string>();
  const unknownStores = new Set<string>();

  const resolved: { userId: string; storeId: string; date: Date; start: string; end: string }[] =
    [];

  for (const shift of parsed) {
    const userId = userByEmail.get(shift.email);
    if (!userId) {
      unknownEmails.add(shift.email);
      result.skipped += 1;
      continue;
    }

    const storeId = storeByKey.get(shift.storeName.trim().toLowerCase());
    if (!storeId) {
      unknownStores.add(shift.storeName || "(tom)");
      result.skipped += 1;
      continue;
    }

    resolved.push({
      userId,
      storeId,
      date: dateOnly(shift.date),
      start: shift.startTime,
      end: shift.endTime,
    });
  }

  result.unknownEmails = [...unknownEmails];
  result.unknownStores = [...unknownStores];

  if (resolved.length === 0) return result;

  const dates = resolved.map((shift) => shift.date.getTime());
  const from = new Date(Math.min(...dates));
  const to = new Date(Math.max(...dates));
  result.from = from.toISOString().slice(0, 10);
  result.to = to.toISOString().slice(0, 10);

  const batch = `${source}-${Date.now()}`;
  const userIds = [...new Set(resolved.map((shift) => shift.userId))];

  await prisma.$transaction(async (tx) => {
    const cleared = await tx.shift.deleteMany({
      where: { userId: { in: userIds }, date: { gte: from, lte: to } },
    });
    result.replaced = cleared.count;

    // Deduplicated here rather than with createMany's skipDuplicates, which
    // the SQLite connector does not support. The key matches the unique
    // constraint, so a file listing the same shift twice imports once instead
    // of failing the whole upload.
    const seen = new Set<string>();
    const unique = resolved.filter((shift) => {
      const key = `${shift.userId}|${shift.date.toISOString()}|${shift.start}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const created = await tx.shift.createMany({
      data: unique.map((shift) => ({
        userId: shift.userId,
        storeId: shift.storeId,
        date: shift.date,
        startTime: shift.start,
        endTime: shift.end,
        source,
        importBatch: batch,
      })),
    });
    result.created = created.count;
  });

  return result;
}

export async function countShifts(): Promise<{ total: number; upcoming: number }> {
  const today = startOfToday();
  const [total, upcoming] = await Promise.all([
    prisma.shift.count(),
    prisma.shift.count({ where: { date: { gte: today } } }),
  ]);
  return { total, upcoming };
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
