/**
 * Creates one ADMIN plus one OWNER per store.
 *
 * Idempotent: an account that already exists keeps its password, so re-running
 * this after you have changed a password will not reset it. Passwords come from
 * SEED_ADMIN_PASSWORD / SEED_OWNER_PASSWORD when set.
 */
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/db";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@pouchclub.se";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "byt-mig-admin";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "byt-mig-butik";
const BCRYPT_ROUNDS = 12;

async function upsertUser(input: {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "OWNER";
  storeIds: string[];
}): Promise<"created" | "kept"> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    // Keep the password, but make sure store access matches the current stores.
    for (const storeId of input.storeIds) {
      await prisma.storeAccess.upsert({
        where: { userId_storeId: { userId: existing.id, storeId } },
        update: {},
        create: { userId: existing.id, storeId },
      });
    }
    return "kept";
  }

  await prisma.user.create({
    data: {
      email: input.email,
      hashedPassword: await hash(input.password, BCRYPT_ROUNDS),
      name: input.name,
      role: input.role,
      storeAccess: { create: input.storeIds.map((storeId) => ({ storeId })) },
    },
  });
  return "created";
}

async function main() {
  const stores = await prisma.store.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  if (stores.length === 0) {
    console.error("No stores found. Run `npm run setup` first.");
    process.exit(1);
  }

  let created = 0;
  let kept = 0;

  const adminResult = await upsertUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: "Pouch Club Admin",
    role: "ADMIN",
    // An ADMIN reaches every store through its role, so it needs no rows here.
    storeIds: [],
  });
  adminResult === "created" ? (created += 1) : (kept += 1);
  console.log(`  ${adminResult === "created" ? "+" : "="} ${ADMIN_EMAIL} (ADMIN)`);

  for (const store of stores) {
    const email = `${store.slug}@pouchclub.se`;
    const result = await upsertUser({
      email,
      password: OWNER_PASSWORD,
      name: `${store.name} — butiksägare`,
      role: "OWNER",
      storeIds: [store.id],
    });
    result === "created" ? (created += 1) : (kept += 1);
    console.log(`  ${result === "created" ? "+" : "="} ${email} (OWNER → ${store.name})`);
  }

  console.log(`\n${created} account(s) created, ${kept} already existed.`);
  if (created > 0) {
    console.log("Change these passwords: /admin/users, or re-run with SEED_*_PASSWORD set.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
