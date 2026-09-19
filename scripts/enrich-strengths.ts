/**
 * Matches the facts pulled from snusbolaget.se onto our own catalog by EAN and
 * fills in the nicotine figures the supplier masterdoc leaves blank.
 *
 * EAN is an exact join — both sides carry the manufacturer's gtin13 — so no
 * fuzzy name matching is involved and a wrong match is very unlikely.
 *
 * Dry run by default; pass --apply to write.
 *
 * It never touches `strength`. That field is part of the product's unique key
 * and is how the importer finds an existing row, so rewriting it would make the
 * next catalog import create duplicates. The figures land in their own columns
 * and the order page falls back to them when `strength` is blank.
 */
import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import type { ProductFacts } from "./fetch-snusbolaget";

const SOURCE = "snusbolaget.se";

async function main() {
  const apply = process.argv.includes("--apply");
  const facts: ProductFacts[] = JSON.parse(await readFile("data/snusbolaget-facts.json", "utf8"));

  // EAN -> facts. A product can carry either the consumer or the outer EAN, so
  // both of ours are checked against their gtin13.
  const byEan = new Map<string, ProductFacts>();
  for (const fact of facts) {
    if (fact.ean) byEan.set(String(fact.ean).trim(), fact);
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      brand: true,
      flavor: true,
      strength: true,
      format: true,
      eanKfp: true,
      eanDfp: true,
      nicotineMgPerPortion: true,
    },
  });

  let matched = 0;
  let filled = 0;
  let alreadyHadStrength = 0;
  const examples: string[] = [];

  for (const product of products) {
    const fact =
      (product.eanKfp ? byEan.get(product.eanKfp) : undefined) ??
      (product.eanDfp ? byEan.get(product.eanDfp) : undefined);

    if (!fact) continue;
    matched += 1;

    if (
      fact.nicotineMgPerPortion === null &&
      fact.nicotineMgPerGram === null &&
      !fact.manufacturer
    ) {
      continue;
    }

    const fillsAGap = !product.strength;
    if (!fillsAGap) alreadyHadStrength += 1;
    else filled += 1;

    if (fillsAGap && examples.length < 12) {
      examples.push(
        `  ${product.brand} / ${product.flavor} / ${product.format}` +
          `  →  ${fact.nicotineMgPerPortion ?? "?"} mg/portion   [${fact.name}]`
      );
    }

    if (apply) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          nicotineMgPerPortion: fact.nicotineMgPerPortion,
          nicotineMgPerGram: fact.nicotineMgPerGram,
          portionsPerCan: fact.portionsPerCan ? Math.trunc(fact.portionsPerCan) : null,
          manufacturer: fact.manufacturer,
          nicotineSource: SOURCE,
          nicotineCheckedAt: new Date(),
        },
      });
    }
  }

  console.log(`${facts.length} scraped products, ${byEan.size} with an EAN.`);
  console.log(`${products.length} active products in our catalog.`);
  console.log(`\nMatched by EAN: ${matched}`);
  console.log(`  fills a blank strength: ${filled}`);
  console.log(`  already had a strength: ${alreadyHadStrength}`);
  if (examples.length > 0) {
    console.log(`\nExamples of gaps this fills:\n${examples.join("\n")}`);
  }
  console.log(apply ? "\nWritten." : "\nDry run — pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
