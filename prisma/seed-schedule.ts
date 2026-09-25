/**
 * Gives the existing stores a region and the seeded users a phone number, so
 * the team schedule has something to group and someone to call.
 *
 * Idempotent: only fills values that are still empty.
 */
import { prisma } from "../src/lib/db";

const REGIONS: Record<string, string> = {
  "taby-centrum": "Stockholm",
  vastermalmsgallerian: "Stockholm",
  helsingborg: "Syd",
  linkoping: "Öst",
  orebro: "Mitt",
};

async function main() {
  for (const [slug, region] of Object.entries(REGIONS)) {
    const updated = await prisma.store.updateMany({
      where: { slug, region: null },
      data: { region },
    });
    if (updated.count > 0) console.log(`  ${slug} -> ${region}`);
  }

  // Placeholder numbers so the contact links render; real ones go in /admin/users.
  const users = await prisma.user.findMany({
    where: { phone: null },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });

  for (const [index, user] of users.entries()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: `070-000 ${String(10 + index).padStart(2, "0")} ${String(index + 1).padStart(2, "0")}` },
    });
  }
  if (users.length > 0) console.log(`  ${users.length} placeholder phone number(s) set`);

  const byRegion = await prisma.store.groupBy({ by: ["region"], _count: true });
  console.log("\nRegions:", byRegion.map((r) => `${r.region ?? "(none)"}=${r._count}`).join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
