/**
 * Imports supplier brand content from content/brands/*.md.
 *
 * Idempotent and non-destructive: a field that already has content is left
 * alone unless --force is passed. Brands are matched by name,
 * case-insensitively, so a file saying "FUMi" updates the existing "Fumi" row
 * rather than creating a second one — it never creates a Brand that is not
 * already in the catalog.
 *
 * Pages are always left unpublished. Publishing is a human decision.
 *
 *   npm run brands:import
 *   npm run brands:import -- --force
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";

const DIR = "content/brands";

/** Long-form fields, written as `## <field>` sections in the file body. */
const BODY_FIELDS = ["manufacturingProcess", "blendingNotes", "products"] as const;

type BrandFile = {
  file: string;
  name: string;
  countryOfOrigin: string | null;
  websiteUrl: string | null;
  shortDescription: string | null;
  manufacturingProcess: string | null;
  blendingNotes: string | null;
  /** sku -> supplier description */
  products: Map<string, string>;
};

/**
 * Minimal frontmatter reader: `key: value` plus `key: |` block scalars.
 * Enough for these files and avoids a YAML dependency.
 */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  const lines = match[1].split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z][\w]*):\s*(.*)$/);
    if (!kv) continue;

    const [, key, value] = kv;
    if (value.trim() === "|") {
      const block: string[] = [];
      while (i + 1 < lines.length && /^\s{2,}/.test(lines[i + 1])) {
        block.push(lines[i + 1].replace(/^\s{2}/, ""));
        i += 1;
      }
      // A block scalar here is prose, so soft-wrapped lines rejoin.
      data[key] = block.join("\n").replace(/\n(?!\n)/g, " ").trim();
    } else {
      data[key] = value.trim();
    }
  }
  return { data, body: match[2] };
}

/**
 * Splits the body on the known field markers only.
 *
 * The long fields contain their own `##` headings ("## Styrkor"), so splitting
 * on every heading would truncate them — only `## manufacturingProcess`,
 * `## blendingNotes` and `## products` start a new field.
 */
function parseBody(body: string): Record<string, string> {
  const marker = new RegExp(`^## (${BODY_FIELDS.join("|")})\\s*$`, "gm");
  const sections: Record<string, string> = {};

  const hits = [...body.matchAll(marker)];
  hits.forEach((hit, index) => {
    const start = hit.index! + hit[0].length;
    const end = index + 1 < hits.length ? hits[index + 1].index! : body.length;
    const text = body
      .slice(start, end)
      // Drop HTML comments — they are notes to ourselves, not page content.
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();
    if (text) sections[hit[1]] = text;
  });

  return sections;
}

function parseProducts(text: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!text) return map;

  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z]{2,}-?\d[\w-]*):\s*(.+)$/);
    if (match) map.set(match[1].trim(), match[2].trim());
  }
  return map;
}

async function readBrandFiles(): Promise<BrandFile[]> {
  const names = (await readdir(DIR)).filter((file) => file.endsWith(".md")).sort();
  const files: BrandFile[] = [];

  for (const file of names) {
    const raw = await readFile(path.join(DIR, file), "utf8");
    const { data, body } = parseFrontmatter(raw);
    const sections = parseBody(body);

    if (!data.name) {
      console.warn(`  ! ${file}: no \`name\` in frontmatter — skipped`);
      continue;
    }

    files.push({
      file,
      name: data.name,
      countryOfOrigin: data.countryOfOrigin || null,
      websiteUrl: data.websiteUrl || null,
      shortDescription: data.shortDescription || null,
      manufacturingProcess: sections.manufacturingProcess ?? null,
      blendingNotes: sections.blendingNotes ?? null,
      products: parseProducts(sections.products),
    });
  }
  return files;
}

type FieldReport = { field: string; action: "filled" | "skipped" | "overwritten" | "empty" };

const BRAND_SELECT = {
  id: true,
  name: true,
  slug: true,
  published: true,
  countryOfOrigin: true,
  websiteUrl: true,
  shortDescription: true,
  manufacturingProcess: true,
  blendingNotes: true,
} as const;

/**
 * Case-insensitive brand lookup, done in JS because Prisma's
 * `mode: "insensitive"` is not supported by the SQLite connector. The table is
 * ~73 rows, so loading it once is cheaper than the alternatives.
 */
async function loadBrands() {
  const brands = await prisma.brand.findMany({ select: BRAND_SELECT });
  const byLowerName = new Map(brands.map((brand) => [brand.name.toLowerCase(), brand]));
  return (name: string) => byLowerName.get(name.trim().toLowerCase()) ?? null;
}

async function main() {
  const force = process.argv.includes("--force");
  const files = await readBrandFiles();
  const findBrand = await loadBrands();

  console.log(`${files.length} content file(s)${force ? " — FORCE: existing content will be overwritten" : ""}\n`);

  const unmatchedSkus: { brand: string; sku: string }[] = [];
  let productsFilled = 0;
  let productsSkipped = 0;

  for (const file of files) {
    // Case-insensitive so "FUMi" finds "Fumi" instead of duplicating it.
    const brand = findBrand(file.name);

    if (!brand) {
      console.log(`${file.name} (${file.file})`);
      console.log(`  ! no Brand row named "${file.name}" — skipped, nothing created.`);
      console.log(`    Brands come from the catalog; import products first.\n`);
      continue;
    }

    const spellingNote =
      brand.name !== file.name ? `  (catalog spells it "${brand.name}" — merged, not duplicated)` : "";
    console.log(`${file.name} -> ${brand.name}${spellingNote}`);

    const data: Record<string, string> = {};
    const report: FieldReport[] = [];

    for (const field of [
      "countryOfOrigin",
      "websiteUrl",
      "shortDescription",
      "manufacturingProcess",
      "blendingNotes",
    ] as const) {
      const incoming = file[field];
      const existing = brand[field];

      if (!incoming) {
        report.push({ field, action: "empty" });
        continue;
      }
      if (existing && !force) {
        report.push({ field, action: "skipped" });
        continue;
      }
      data[field] = incoming;
      report.push({ field, action: existing ? "overwritten" : "filled" });
    }

    // Publishing is always a human decision, so this is set regardless.
    const unpublishing = brand.published;

    await prisma.brand.update({
      where: { id: brand.id },
      data: { ...data, published: false },
    });

    for (const entry of report) {
      const symbol =
        entry.action === "filled" ? "+" : entry.action === "overwritten" ? "~" : entry.action === "skipped" ? "=" : " ";
      const note =
        entry.action === "skipped"
          ? "redan ifylld, lämnad orörd (kör med --force för att skriva över)"
          : entry.action === "empty"
            ? "inget i källan — lämnas tom, sidan visar \"Innehåll kommer snart\""
            : entry.action === "overwritten"
              ? "SKREV ÖVER befintligt innehåll"
              : "ifylld";
      console.log(`  ${symbol} ${entry.field}: ${note}`);
    }
    if (unpublishing) console.log(`  · published: satt till false (var publicerad)`);

    // ---- product descriptions ----
    for (const [sku, description] of file.products) {
      const products = await prisma.product.findMany({
        where: { sku },
        select: { id: true, description: true, flavor: true },
      });

      if (products.length === 0) {
        unmatchedSkus.push({ brand: brand.name, sku });
        continue;
      }

      for (const product of products) {
        if (product.description && !force) {
          productsSkipped += 1;
          continue;
        }
        await prisma.product.update({ where: { id: product.id }, data: { description } });
        productsFilled += 1;
      }
    }

    if (file.products.size > 0) {
      console.log(`  · produkttexter: ${file.products.size} i filen`);
    }
    console.log("");
  }

  console.log(`Produkttexter: ${productsFilled} ifyllda, ${productsSkipped} hoppades över (redan ifyllda).`);

  if (unmatchedSkus.length > 0) {
    console.log(`\nArtikelnummer i källan utan träff i katalogen (${unmatchedSkus.length}):`);
    for (const row of unmatchedSkus) console.log(`  ${row.brand}: ${row.sku}`);
  }

  // The other direction: catalog products with no supplier text.
  for (const file of files) {
    if (file.products.size === 0) continue;
    const brand = findBrand(file.name);
    if (!brand) continue;

    const without = await prisma.product.findMany({
      where: { brandId: brand.id, active: true, description: null },
      select: { sku: true, flavor: true, strength: true },
      orderBy: { flavor: "asc" },
    });
    if (without.length === 0) continue;

    console.log(`\n${brand.name}: ${without.length} aktiva produkter utan smaktext:`);
    for (const product of without) {
      console.log(`  ${(product.sku ?? "(utan sku)").padEnd(10)} ${product.flavor} ${product.strength ?? ""}`.trimEnd());
    }
  }

  console.log("\nInget publicerades. Läs sidorna och publicera själv i /admin/brands.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
