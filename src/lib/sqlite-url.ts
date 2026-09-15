import path from "node:path";

/**
 * DATABASE_URL is written as a project-root-relative path ("file:./prisma/dev.db").
 * Prisma's CLI resolves relative SQLite paths against the schema directory while
 * better-sqlite3 resolves against process.cwd(), so we normalise to an absolute
 * path in both places and sidestep the mismatch entirely.
 */
export function resolveSqliteUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const withoutScheme = raw.startsWith("file:") ? raw.slice("file:".length) : raw;

  if (withoutScheme === ":memory:") return withoutScheme;
  if (path.isAbsolute(withoutScheme)) return `file:${withoutScheme}`;

  return `file:${path.resolve(/*turbopackIgnore: true*/ process.cwd(), withoutScheme)}`;
}

/** Plain filesystem path (no `file:` scheme) for better-sqlite3. */
export function resolveSqlitePath(): string {
  const url = resolveSqliteUrl();
  return url.startsWith("file:") ? url.slice("file:".length) : url;
}
