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
import { foldFlavor } from "../src/lib/flavor-match";

const DIR = "content/brands";

/** Long-form fields, written as `## <field>` sections in the file body. */
const BODY_FIELDS = ["manufacturingProcess", "blendingNotes", "products", "flavors"] as const;

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
  /**
   * Flavour name -> supplier description, for sources that identify a product
   * by name rather than by article number. Loop's deck has no SKUs in it.
   */
  flavors: Map<string, string>;
  strengthUnit: string | null;
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
      // A blank line is part of the block, not the end of it — it is how a
      // paragraph break is written. The block ends at the first line that has
      // content and is not indented. Without this the reader stopped at the
      // first empty line and silently kept only the opening paragraph.
      while (
        i + 1 < lines.length &&
        (lines[i + 1].trim() === "" || /^\s{2,}/.test(lines[i + 1]))
      ) {
        block.push(lines[i + 1].replace(/^\s{2}/, ""));
        i += 1;
      }
      while (block.length > 0 && block[block.length - 1].trim() === "") block.pop();
      // Newlines are kept as written. Markdown treats a single newline inside
      // a paragraph as a soft break, so soft-wrapped prose still renders as
      // one paragraph — while a blank line stays a paragraph break and a
      // "- " line stays a list. Collapsing them, as this did, made a heading
      // or a list in a block scalar impossible to express.
      data[key] = block.join("\n").trim();
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

/** `Flavour name: description` lines, one per line. */
function parseFlavors(text: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!text) return map;

  for (const line of text.split("\n")) {
    const match = line.match(/^([^:#|][^:]*?):\s*(.+)$/);
    if (match) map.set(match[1].trim(), match[2].trim());
  }
  return map;
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
      flavors: parseFlavors(sections.flavors),
      strengthUnit: data.strengthUnit || null,
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
  strengthUnit: true,
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
  /** Source flavours with nothing to attach to in our catalog. */
  const unmatchedFlavors: { brand: string; flavor: string }[] = [];
  /** Our products the source never mentions. */
  const unlistedProducts: { brand: string; flavor: string; strength: string; format: string }[] = [];
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
      "strengthUnit",
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

    /**
     * Unpublish only when this run actually wrote prose.
     *
     * The rule is that nobody reads supplier text on a live page before a
     * human has looked at it — so new or changed content takes the page down.
     * But re-running the importer must not undo a publishing decision someone
     * already made: a no-op run over Fumi, Helwit and XQS used to unpublish
     * all three, which is the opposite of leaving their choices alone.
     *
     * Metadata-only fields (country, website, strengthUnit) do not count.
     * They add a line of fact, not a page of supplier claims.
     */
    const PROSE_FIELDS = ["shortDescription", "manufacturingProcess", "blendingNotes"] as const;
    const wroteProse = PROSE_FIELDS.some((field) => field in data);
    const unpublishing = brand.published && wroteProse;

    await prisma.brand.update({
      where: { id: brand.id },
      data: { ...data, ...(wroteProse ? { published: false } : {}) },
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
    if (unpublishing) {
      console.log(`  · published: satt till false (var publicerad, nytt innehåll ska läsas först)`);
    } else if (brand.published) {
      console.log(`  · published: oförändrad (publicerad sedan tidigare, inget nytt innehåll)`);
    }

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

    // ---- product descriptions matched on flavour name ----
    //
    // A supplier deck that lists flavours but no article numbers (Loop's does
    // not have one on any slide) still has to reach the catalog somehow. The
    // match is on the folded flavour name, scoped to this brand's own active
    // products, so it can never touch another brand's row.
    if (file.flavors.size > 0) {
      const catalog = await prisma.product.findMany({
        where: { brandId: brand.id, active: true },
        select: { id: true, flavor: true, strength: true, format: true, description: true },
      });

      const byFolded = new Map<string, typeof catalog>();
      for (const product of catalog) {
        const key = foldFlavor(product.flavor);
        const list = byFolded.get(key) ?? [];
        list.push(product);
        byFolded.set(key, list);
      }

      const matchedKeys = new Set<string>();

      for (const [flavor, description] of file.flavors) {
        const key = foldFlavor(flavor);
        const products = byFolded.get(key);

        if (!products || products.length === 0) {
          unmatchedFlavors.push({ brand: brand.name, flavor });
          continue;
        }
        matchedKeys.add(key);

        for (const product of products) {
          if (product.description && !force) {
            productsSkipped += 1;
            continue;
          }
          await prisma.product.update({ where: { id: product.id }, data: { description } });
          productsFilled += 1;
        }
      }

      // The other direction, per brand: what the catalog carries that the
      // source never mentioned.
      for (const [key, products] of byFolded) {
        if (matchedKeys.has(key)) continue;
        for (const product of products) {
          unlistedProducts.push({
            brand: brand.name,
            flavor: product.flavor,
            strength: product.strength,
            format: product.format,
          });
        }
      }

      console.log(
        `  · smaktexter: ${file.flavors.size} smaker i källan, ${matchedKeys.size} hittade i katalogen`
      );
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

  if (unmatchedFlavors.length > 0) {
    console.log(`\nSmaker i källan som inte finns i vårt sortiment (${unmatchedFlavors.length}):`);
    for (const row of unmatchedFlavors) console.log(`  ${row.brand}: ${row.flavor}`);
    console.log(`  (Leverantörens sortiment är bredare än vårt. Inget lades till.)`);
  }

  if (unlistedProducts.length > 0) {
    console.log(`\nVåra aktiva produkter som källan inte nämner (${unlistedProducts.length}):`);
    for (const row of unlistedProducts) {
      console.log(
        `  ${row.brand}: ${row.flavor} ${row.strength} ${row.format}`.replace(/\s+/g, " ").trimEnd()
      );
    }
    console.log(`  (Ingen avaktiverades. De saknar bara smaktext.)`);
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

  console.log(
    "\nInget publicerades. Sidor som fick nytt innehåll avpublicerades — läs dem och publicera själv i /admin/brands."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
