/**
 * Creates a Brand row for every brand already parsed onto a Product and links
 * the products to it. Safe to re-run: existing brands and their content are
 * left alone.
 *
 * Pass --publish to also publish brands that have active products. New brands
 * always arrive as drafts (Brand.published defaults to false); this flag exists
 * to populate the guide on day one, so /staff is not empty while the content is
 * still being written. Each such page shows "Innehåll kommer snart" until it
 * has content.
 */
import { prisma } from "../src/lib/db";
import { syncBrandsFromProducts } from "../src/lib/repositories/brands";

async function main() {
  const publish = process.argv.includes("--publish");
  const result = await syncBrandsFromProducts();

  console.log(
    `Brands: ${result.brands} total, ${result.created} created. Linked ${result.linked} product(s).`
  );

  if (!publish) {
    console.log("Not publishing (pass --publish to show them in /staff).");
    return;
  }

  // Filter directly rather than collecting ids into an `in` list — that would
  // be one bind parameter per brand and hit SQLite's 999-parameter ceiling.
  const published = await prisma.brand.updateMany({
    where: { published: false, products: { some: { active: true } } },
    data: { published: true },
  });

  console.log(
    published.count === 0
      ? "Nothing to publish."
      : `Published ${published.count} brand page(s).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
