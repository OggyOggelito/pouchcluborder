import { defineConfig } from "prisma/config";
import { resolveSqliteUrl } from "./src/lib/sqlite-url";

// Keeps the Prisma CLI and the runtime driver adapter pointed at exactly the
// same database file, regardless of where either is invoked from.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: resolveSqliteUrl() },
  migrations: { seed: "tsx prisma/seed.ts" },
});
