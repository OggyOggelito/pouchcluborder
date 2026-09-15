import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveSqlitePath } from "./sqlite-url";

// Single Prisma instance, reused across hot reloads in dev so we don't exhaust
// file handles. Swapping to Postgres later means changing the adapter here and
// the provider in schema.prisma — nothing else in the app touches Prisma directly
// except src/lib/repositories/*.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: resolveSqlitePath() });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
