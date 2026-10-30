/**
 * Derives Product.flavorTags from the rules in src/lib/flavor-tags.ts.
 *
 * Safe to run after every catalog import: rows where an admin has set the tags
 * by hand (`tagsEditedByAdmin`) are skipped, so hand-sorting is never undone by
 * a re-import. Pass --force to re-derive those too.
 */
import { prisma } from "../src/lib/db";
import { serializeTags, tagsForFlavor } from "../src/lib/flavor-tags";

async function main() {
  const force = process.argv.includes("--force");

  const products = await prisma.product.findMany({
    select: { id: true, flavor: true, flavorTags: true, tagsEditedByAdmin: true },
  });

  let updated = 0;
  let unchanged = 0;
  let protectedRows = 0;
  let untagged = 0;

  for (const product of products) {
    if (product.tagsEditedByAdmin && !force) {
      protectedRows += 1;
      continue;
    }

    const next = serializeTags(tagsForFlavor(product.flavor));
    if (next === null) untagged += 1;

    if (next === product.flavorTags) {
      unchanged += 1;
      continue;
    }

    await prisma.product.update({ where: { id: product.id }, data: { flavorTags: next } });
    updated += 1;
  }

  console.log(`${products.length} products`);
  console.log(`  ${updated} updated, ${unchanged} already correct`);
  console.log(`  ${protectedRows} skipped (hand-edited${force ? ", but --force overrode" : ""})`);
  console.log(`  ${untagged} ended up with no group — sort them at /admin/flavor-tags`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
