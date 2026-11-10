/**
 * Seeds the opening hours the chain gave us, exactly as given.
 *
 *   Butik          Mån–Fre       Lör           Sön
 *   Täby Centrum   10:00–20:00   10:00–18:00   10:00–18:00
 *   Kungsholmen    07:00–20:00   10:00–18:00   10:00–18:00
 *   Linköping      10:00–19:00   10:00–17:00   Stängt
 *   Helsingborg    10:00–19:00   10:00–16:00   12:00–16:00
 *   Örebro         10:00–19:00   10:00–17:00   Stängt
 *
 * Stores are matched on their name, case-insensitively and ignoring spaces.
 * A name with no store is reported, not created: inventing a shop to hang
 * hours on would be worse than a missing row, because nothing downstream
 * would ever question it.
 *
 * Idempotent. A weekday that already has hours is left alone, so a store that
 * has since changed its own times is not reset by a re-run. `--force`
 * overwrites, and `--alias "Namn=Butiksnamn"` maps one of the names above onto
 * a store that is called something else in the database.
 *
 * Usage:
 *   npm run seed:hours
 *   npm run seed:hours -- --force
 *   npm run seed:hours -- --alias "Kungsholmen=Västermalmsgallerian"
 */
import { prisma } from "../src/lib/db";

type DayHours = { opensAt: string; closesAt: string; closed?: boolean };

type StoreHours = {
  name: string;
  weekdays: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

/**
 * A closed Sunday still gets times. The column keeps them so that switching
 * the day back on does not mean retyping it, and the UI shows "Stängt"
 * whatever they are; the Saturday's hours are the least surprising starting
 * point. Nothing reads them while `closed` is true.
 */
const HOURS: StoreHours[] = [
  {
    name: "Täby Centrum",
    weekdays: { opensAt: "10:00", closesAt: "20:00" },
    saturday: { opensAt: "10:00", closesAt: "18:00" },
    sunday: { opensAt: "10:00", closesAt: "18:00" },
  },
  {
    name: "Kungsholmen",
    weekdays: { opensAt: "07:00", closesAt: "20:00" },
    saturday: { opensAt: "10:00", closesAt: "18:00" },
    sunday: { opensAt: "10:00", closesAt: "18:00" },
  },
  {
    name: "Linköping",
    weekdays: { opensAt: "10:00", closesAt: "19:00" },
    saturday: { opensAt: "10:00", closesAt: "17:00" },
    sunday: { opensAt: "10:00", closesAt: "17:00", closed: true },
  },
  {
    name: "Helsingborg",
    weekdays: { opensAt: "10:00", closesAt: "19:00" },
    saturday: { opensAt: "10:00", closesAt: "16:00" },
    sunday: { opensAt: "12:00", closesAt: "16:00" },
  },
  {
    name: "Örebro",
    weekdays: { opensAt: "10:00", closesAt: "19:00" },
    saturday: { opensAt: "10:00", closesAt: "17:00" },
    sunday: { opensAt: "10:00", closesAt: "17:00", closed: true },
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function parseAliases(argv: string[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--alias") continue;
    const [from, to] = (argv[index + 1] ?? "").split("=");
    if (from && to) aliases.set(normalize(from), normalize(to));
  }
  return aliases;
}

function weekFor(hours: StoreHours): (DayHours & { weekday: number })[] {
  return [
    ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, ...hours.weekdays })),
    { weekday: 6, ...hours.saturday },
    { weekday: 7, ...hours.sunday },
  ];
}

async function main() {
  const force = process.argv.includes("--force");
  const aliases = parseAliases(process.argv);

  const stores = await prisma.store.findMany({ select: { id: true, name: true } });
  const byName = new Map(stores.map((store) => [normalize(store.name), store]));

  const unmatched: string[] = [];
  let written = 0;
  let kept = 0;

  for (const hours of HOURS) {
    const key = aliases.get(normalize(hours.name)) ?? normalize(hours.name);
    const store = byName.get(key);

    if (!store) {
      unmatched.push(hours.name);
      continue;
    }

    const existing = await prisma.storeOpeningHours.findMany({
      where: { storeId: store.id },
      select: { weekday: true },
    });
    const have = new Set(existing.map((row) => row.weekday));

    for (const day of weekFor(hours)) {
      if (have.has(day.weekday) && !force) {
        kept += 1;
        continue;
      }

      await prisma.storeOpeningHours.upsert({
        where: { storeId_weekday: { storeId: store.id, weekday: day.weekday } },
        create: {
          storeId: store.id,
          weekday: day.weekday,
          opensAt: day.opensAt,
          closesAt: day.closesAt,
          closed: day.closed ?? false,
        },
        update: {
          opensAt: day.opensAt,
          closesAt: day.closesAt,
          closed: day.closed ?? false,
        },
      });
      written += 1;
    }

    const label = store.name === hours.name ? store.name : `${hours.name} -> ${store.name}`;
    console.log(`  ${label}: ${weekFor(hours).length} weekdays`);
  }

  console.log(
    `\n${written} weekday row(s) written, ${kept} left as they were${force ? "" : " (use --force to overwrite)"}.`
  );

  if (unmatched.length > 0) {
    console.log("\nNo store matched these names, so nothing was seeded for them:");
    for (const name of unmatched) console.log(`  - ${name}`);
    console.log("\nStores in the database:");
    for (const store of stores) console.log(`  - ${store.name}`);
    console.log(
      '\nNothing was invented. Either rename the store, or map the name:\n  npm run seed:hours -- --alias "Kungsholmen=Västermalmsgallerian"'
    );
  }

  const missing = await prisma.store.findMany({
    where: { openingHours: { none: {} } },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  if (missing.length > 0) {
    console.log(
      `\nStill without any opening hours: ${missing.map((store) => store.name).join(", ")}.`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
