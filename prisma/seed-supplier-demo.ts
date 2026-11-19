/**
 * Demo data for the supplier portal, clearly marked and easy to remove.
 *
 * Everything it writes is fake: a supplier login on an example.test address,
 * and sales figures generated from a seed so two runs produce the same
 * numbers. Nothing here comes from a real till and nothing is a real person.
 *
 *   npm run seed:supplier-demo              # create
 *   npm run seed:supplier-demo -- --remove  # delete everything it made
 *
 * The removal is exact: supplier accounts on `@example.test`, the sales rows
 * belonging to the imports it created, and the demo-day bookings those
 * accounts made. It never touches anything else.
 */
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/db";

const DEMO_DOMAIN = "@example.test";
const DEMO_SOURCE = "demo-seed";
const DEMO_PASSWORD = "demo-losenord-1234";

/** Deterministic, so re-running does not invent a different history. */
function pseudoRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

function dateKey(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function remove() {
  const suppliers = await prisma.supplierUser.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: { id: true, email: true },
  });

  const bookings = await prisma.demoDayBooking.deleteMany({
    where: { supplierUserId: { in: suppliers.map((row) => row.id) } },
  });

  const imports = await prisma.salesImport.findMany({
    where: { source: DEMO_SOURCE },
    select: { id: true },
  });
  const sales = await prisma.salesDaily.deleteMany({
    where: { importId: { in: imports.map((row) => row.id) } },
  });
  await prisma.salesImport.deleteMany({ where: { source: DEMO_SOURCE } });

  const removed = await prisma.supplierUser.deleteMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
  });

  console.log(
    `Removed ${removed.count} demo supplier account(s), ${bookings.count} booking(s) and ${sales.count} sales row(s).`
  );
}

async function create() {
  const brands = await prisma.brand.findMany({
    where: { products: { some: { active: true } } },
    orderBy: { name: "asc" },
    take: 2,
    select: { id: true, name: true, slug: true },
  });
  if (brands.length === 0) {
    console.error("No brand has any active products. Run the catalog import first.");
    process.exit(1);
  }

  const hashed = await hash(DEMO_PASSWORD, 12);
  for (const brand of brands) {
    const email = `demo.${brand.slug}${DEMO_DOMAIN}`;
    await prisma.supplierUser.upsert({
      where: { email },
      create: {
        email,
        name: `Demo ${brand.name}`,
        brandId: brand.id,
        hashedPassword: hashed,
      },
      update: { brandId: brand.id, hashedPassword: hashed, active: true },
    });
    console.log(`  ${email} -> ${brand.name}`);
  }

  const [stores, products] = await Promise.all([
    prisma.store.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany({
      where: { active: true, brandId: { in: brands.map((brand) => brand.id) } },
      select: { id: true, unitPrice: true },
      take: 40,
    }),
  ]);

  if (stores.length === 0 || products.length === 0) {
    console.error("Need at least one store and one product.");
    process.exit(1);
  }

  const DAYS = 60;
  const record = await prisma.salesImport.create({
    data: {
      source: DEMO_SOURCE,
      fileName: "demo (påhittad försäljning)",
      fromDate: dateKey(DAYS - 1),
      toDate: dateKey(0),
      rowsRead: 0,
      rowsStored: 0,
      rowsUnmatched: 0,
    },
    select: { id: true },
  });

  const random = pseudoRandom(20_261_119);
  let written = 0;

  for (let day = 0; day < DAYS; day += 1) {
    const date = dateKey(day);
    for (const store of stores) {
      for (const product of products) {
        // Most products do not sell in most shops on most days.
        if (random() > 0.35) continue;
        const quantity = 1 + Math.floor(random() * 6);
        const unit = product.unitPrice ?? 55;

        await prisma.salesDaily.upsert({
          where: {
            storeId_date_productId: { storeId: store.id, date, productId: product.id },
          },
          create: {
            storeId: store.id,
            date,
            productId: product.id,
            quantity,
            amount: Math.round(quantity * unit * 100) / 100,
            importId: record.id,
          },
          update: {},
        });
        written += 1;
      }
    }
  }

  await prisma.salesImport.update({
    where: { id: record.id },
    data: { rowsRead: written, rowsStored: written },
  });

  console.log(`\n${written} fake sales rows over ${DAYS} days.`);
  console.log(`Password for every demo supplier account: ${DEMO_PASSWORD}`);
  console.log("Remove it all again with: npm run seed:supplier-demo -- --remove");
}

async function main() {
  if (process.argv.includes("--remove")) {
    await remove();
    return;
  }
  await create();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
