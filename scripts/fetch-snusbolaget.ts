/**
 * Pulls factual product specs from snusbolaget.se to fill gaps in our own
 * catalog — above all the nicotine strength the supplier masterdoc leaves out.
 *
 * What is taken: EAN/gtin13, article name, brand name, manufacturer, format,
 * weight, portion count and the manufacturer's nicotine figures. These are
 * factual specifications.
 *
 * What is deliberately NOT taken: the product and brand descriptions (their
 * own written copy) and "Snusbolagets styrka" (their editorial strength
 * rating, not a manufacturer fact).
 *
 * Polite by construction: one request at a time with a delay, a User-Agent
 * that says who we are, and an on-disk cache so a re-run costs them nothing.
 * robots.txt (checked 2026-09-19) disallows only /sok?, and the product
 * sitemap is advertised there.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const SITEMAP = "https://www.snusbolaget.se/sitemap/sitemap-products.xml";
const UA =
  "PouchClubCatalogBot/1.0 (+internal catalog enrichment; contact oscar.gullberg99@gmail.com)";
const DELAY_MS = 700;
const CACHE_DIR =
  process.env.SNUS_CACHE ??
  "/private/tmp/claude-501/-Users-oscargullberg-pouchcluborder/c3f89d40-8bfb-4cac-9b8f-6a7ad1f48cd8/scratchpad/snuscache";
const OUT = "data/snusbolaget-facts.json";

/** Their editorial rating, not a manufacturer specification. */
const SKIP_PROPS = new Set(["snusbolagets styrka"]);

export type ProductFacts = {
  url: string;
  name: string | null;
  ean: string | null;
  sku: string | null;
  brand: string | null;
  manufacturer: string | null;
  category: string | null;
  weightGrams: number | null;
  nicotineMgPerPortion: number | null;
  nicotineMgPerGram: number | null;
  producerStrength: string | null;
  format: string | null;
  productType: string | null;
  portionsPerCan: number | null;
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** "13,22 mg/g" -> 13.22 */
function num(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseProduct(html: string, url: string): ProductFacts | null {
  // The script tag's type is HTML-entity-encoded on this site
  // (`application/ld&#x2B;json`), so a plain `ld\+json` match finds nothing.
  const blocks = [
    ...html.matchAll(/<script[^>]*ld(?:\+|&#x2B;|&#43;)json[^>]*>([\s\S]*?)<\/script>/gi),
  ];

  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(decodeEntities(block[1].trim()));
    } catch {
      continue;
    }

    for (const item of (Array.isArray(data) ? data : [data]) as Record<string, any>[]) {
      if (item?.["@type"] !== "Product") continue;

      const props: Record<string, string> = {};
      for (const prop of item.additionalProperty ?? []) {
        const name = String(prop?.name ?? "").trim();
        if (!name || SKIP_PROPS.has(name.toLowerCase())) continue;
        props[name] = String(prop?.value ?? "").trim();
      }

      return {
        url,
        name: item.name ?? null,
        ean: item.gtin13 ?? item.identifier ?? null,
        sku: item.sku ?? null,
        // Only the brand's name — `brand.description` is their written copy.
        brand: typeof item.brand === "object" ? (item.brand?.name ?? null) : (item.brand ?? null),
        manufacturer: item.manufacturer?.name ?? null,
        category: item.category ?? null,
        weightGrams: typeof item.weight?.value === "number" ? item.weight.value : null,
        nicotineMgPerPortion: num(props["Nikotinhalt (mg/portion)"]),
        nicotineMgPerGram: num(props["Nikotinhalt (mg/g)"]),
        producerStrength: props["Producentens styrka"] ?? null,
        format: props["Format"] ?? null,
        productType: props["Produkttyp"] ?? null,
        portionsPerCan: num(props["Antal portioner/förpackning"]),
      };
    }
  }
  return null;
}

async function cachedFetch(url: string): Promise<string> {
  const key = createHash("sha1").update(url).digest("hex");
  const file = path.join(CACHE_DIR, `${key}.html`);

  try {
    return await readFile(file, "utf8");
  } catch {
    // Not cached yet — fetch it.
  }

  const response = await fetch(url, {
    headers: { "user-agent": UA, "accept-language": "sv-SE" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  await writeFile(file, html, "utf8");
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  return html;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  const sitemap = await (await fetch(SITEMAP, { headers: { "user-agent": UA } })).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log(`${urls.length} product URLs in the sitemap.`);

  const cachedBefore = (await readdir(CACHE_DIR)).length;
  const results: ProductFacts[] = [];
  let failed = 0;

  for (const [index, url] of urls.entries()) {
    try {
      const facts = parseProduct(await cachedFetch(url), url);
      if (facts) results.push(facts);
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.warn(`  ! ${url} — ${error instanceof Error ? error.message : error}`);
    }

    if ((index + 1) % 100 === 0) {
      console.log(`  ${index + 1}/${urls.length} — ${results.length} parsed, ${failed} failed`);
    }
  }

  await writeFile(OUT, `${JSON.stringify(results, null, 1)}\n`, "utf8");

  const withMg = results.filter((r) => r.nicotineMgPerPortion !== null).length;
  const withEan = results.filter((r) => r.ean).length;
  console.log(
    `\n${results.length} products written to ${OUT}` +
      `\n  ${withEan} with an EAN, ${withMg} with mg/portion` +
      `\n  ${cachedBefore} were already cached; ${failed} failed`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
