/**
 * Compares our assortment with snusbolaget.se's, joined on the manufacturer's
 * EAN so the comparison is exact rather than name-based.
 *
 * Answers three things:
 *   1. Which of our products they also list (and so have figures for).
 *   2. Which of ours they do not list — no external figures available.
 *   3. Which of theirs we do not stock, by brand — an assortment gap.
 *
 * Writes data/assortment-crosscheck.json and prints a summary.
 */
import { readFile, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import type { ProductFacts } from "./fetch-snusbolaget";

async function main() {
  const facts: ProductFacts[] = JSON.parse(await readFile("data/snusbolaget-facts.json", "utf8"));

  const theirsByEan = new Map<string, ProductFacts>();
  for (const fact of facts) {
    if (fact.ean) theirsByEan.set(String(fact.ean).trim(), fact);
  }

  const ours = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      brand: true,
      flavor: true,
      strength: true,
      format: true,
      category: true,
      eanKfp: true,
      eanDfp: true,
      sourceName: true,
    },
  });

  const matchedEans = new Set<string>();
  const matched: { ours: string; theirs: string; mg: number | null; hadStrength: boolean }[] = [];
  const unmatched: { brand: string; label: string; hadStrength: boolean }[] = [];

  for (const product of ours) {
    const hit =
      (product.eanKfp && theirsByEan.get(product.eanKfp)) ||
      (product.eanDfp && theirsByEan.get(product.eanDfp)) ||
      null;

    const label = `${product.brand} / ${product.flavor} / ${product.strength || "—"} / ${product.format}`;

    if (hit) {
      matchedEans.add(String(hit.ean));
      matched.push({
        ours: label,
        theirs: hit.name ?? hit.url,
        mg: hit.nicotineMgPerPortion,
        hadStrength: Boolean(product.strength),
      });
    } else {
      unmatched.push({ brand: product.brand, label, hadStrength: Boolean(product.strength) });
    }
  }

  // Their products we do not carry, grouped by their brand.
  const notStocked = new Map<string, { name: string; mg: number | null; url: string }[]>();
  for (const fact of facts) {
    if (!fact.ean || matchedEans.has(String(fact.ean))) continue;
    const brand = fact.brand ?? "(okänt)";
    const list = notStocked.get(brand) ?? [];
    list.push({ name: fact.name ?? "", mg: fact.nicotineMgPerPortion, url: fact.url });
    notStocked.set(brand, list);
  }

  const gapsClosed = matched.filter((m) => !m.hadStrength && m.mg !== null).length;
  const stillMissing = unmatched.filter((u) => !u.hadStrength).length;

  const report = {
    generatedAt: new Date().toISOString(),
    theirProducts: facts.length,
    ourActiveProducts: ours.length,
    matchedByEan: matched.length,
    ourProductsTheyDoNotList: unmatched.length,
    strengthGapsClosed: gapsClosed,
    strengthGapsStillOpen: stillMissing,
    theirBrandsWeDoNotStock: [...notStocked.entries()]
      .map(([brand, items]) => ({ brand, count: items.length, items }))
      .sort((a, b) => b.count - a.count),
    matched,
    unmatched,
  };

  await writeFile("data/assortment-crosscheck.json", `${JSON.stringify(report, null, 1)}\n`, "utf8");

  console.log(`Them: ${facts.length} products   Us: ${ours.length} active\n`);
  console.log(`Matched on EAN:              ${matched.length}`);
  console.log(`  of which filled a blank strength: ${gapsClosed}`);
  console.log(`Ours they do not list:       ${unmatched.length}`);
  console.log(`  still with no strength:           ${stillMissing}`);
  console.log(`\nTheirs we do not stock: ${facts.length - matchedEans.size}, top brands:`);
  for (const row of report.theirBrandsWeDoNotStock.slice(0, 12)) {
    console.log(`  ${String(row.count).padStart(3)}  ${row.brand}`);
  }
  console.log("\nWritten to data/assortment-crosscheck.json");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
