import * as XLSX from "xlsx";
import { ARTIKELTYP_TO_CATEGORY, isNicotineFreeName } from "@/lib/categories";
import { parseProductName } from "@/lib/product-name-parser";
import type { ProductInput } from "@/lib/repositories/products";

export const SHEET_NAME = "MASTERDOC";

/**
 * Row 1 of the masterdoc is a banner ("Denna rad innehåller en exempelformel");
 * the real headers are on row 2.
 */
const HEADER_ROW_OFFSET = 1;

/**
 * Artikeltyp values we stock. Everything else (cigarettes, cigars, loose
 * tobacco, accessories) is dropped.
 */
export const CATEGORY_MAP = ARTIKELTYP_TO_CATEGORY;

// Note the double space in "Pris 1st  inkl. moms" — it is like that in the file.
const COLUMNS = {
  sku: "Art.nr.",
  name: "Benämning",
  manufacturerCode: "Fabr./Repr.",
  supplier: "Leverantör",
  unitsPerStock: "Innehåll DFP",
  unitPrice: "Pris 1st  inkl. moms",
  casePrice: "Pris 2st inkl. moms",
  costPrice: "Inpris",
  eanKfp: "EAN-kod KFP",
  eanDfp: "EAN-kod DFP",
  stockMin: "Lager min",
  stockMax: "Lager max",
  active: "Aktiv",
  articleType: "Artikeltyp",
} as const;

/**
 * pricePerStock is derived, because the masterdoc has no per-stock price.
 *
 * "cost" is what a restock order actually costs the store: `Inpris` x
 * `Innehåll DFP`. `Pris 1st/2st inkl. moms` are shelf prices the customer pays,
 * not the store — they are still stored per product as unitPrice / casePrice,
 * just not used for order totals.
 */
export const PRICE_BASIS: "cost" | "retail" | "case" = "cost";

export type SupplierRow = ProductInput & {
  sku: string | null;
  category: string;
  manufacturerCode: string | null;
  supplier: string | null;
  unitsPerStock: number | null;
  unitPrice: number | null;
  casePrice: number | null;
  costPrice: number | null;
  eanKfp: string | null;
  eanDfp: string | null;
  stockMin: number | null;
  stockMax: number | null;
  sourceName: string;
  needsReview: boolean;
  reviewNotes: string | null;
};

export type SupplierParseResult = {
  rows: SupplierRow[];
  stats: {
    totalRows: number;
    skippedInactive: number;
    skippedCategory: number;
    skippedUnusable: number;
    mergedDuplicates: number;
    missingPrice: number;
    inferredPackSize: number;
    recategorised: number;
    byCategory: Record<string, number>;
    needsReview: number;
  };
  problems: { name: string; message: string }[];
};

export function parseSupplierWorkbook(data: ArrayBuffer | Buffer): SupplierParseResult {
  const workbook = XLSX.read(data, { type: "buffer" });
  const sheet = workbook.Sheets[SHEET_NAME];

  if (!sheet) {
    throw new Error(
      `Sheet "${SHEET_NAME}" not found. Sheets in this file: ${workbook.SheetNames.join(", ")}.`
    );
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: HEADER_ROW_OFFSET,
    defval: null,
  });

  const stats: SupplierParseResult["stats"] = {
    totalRows: raw.length,
    skippedInactive: 0,
    skippedCategory: 0,
    skippedUnusable: 0,
    mergedDuplicates: 0,
    missingPrice: 0,
    inferredPackSize: 0,
    recategorised: 0,
    byCategory: {},
    needsReview: 0,
  };
  const problems: { name: string; message: string }[] = [];

  // --- Pass 1: filter and parse names, without pricing anything yet. ---------
  type Candidate = {
    record: Record<string, unknown>;
    sourceName: string;
    category: string;
    recategorised: boolean;
    parsed: ReturnType<typeof parseProductName>;
    units: number | null;
  };

  const candidates: Candidate[] = [];

  for (const record of raw) {
    if (text(record[COLUMNS.active]) !== "Ja") {
      stats.skippedInactive += 1;
      continue;
    }

    const articleTypeCategory = CATEGORY_MAP[text(record[COLUMNS.articleType]).toLowerCase()];
    if (!articleTypeCategory) {
      stats.skippedCategory += 1;
      continue;
    }

    const sourceName = text(record[COLUMNS.name]);
    if (!sourceName) {
      stats.skippedUnusable += 1;
      problems.push({ name: "(blank)", message: "Row has no Benämning." });
      continue;
    }

    // The masterdoc files a handful of nicotine-free articles under Vitt Snus.
    // Where the name says so outright, the name wins — and the row then also
    // gets 0mg instead of being flagged for a missing strength.
    const recategorised =
      articleTypeCategory === "Nicotine pouch" && isNicotineFreeName(sourceName);
    const category = recategorised ? "Nicotine-free pouch" : articleTypeCategory;
    if (recategorised) stats.recategorised += 1;

    const units = intOrNull(record[COLUMNS.unitsPerStock]);

    candidates.push({
      record,
      sourceName,
      category,
      recategorised,
      parsed: parseProductName(sourceName, category),
      units: units && units > 0 ? units : null,
    });
  }

  // --- Pack sizes, for the rows where Innehåll DFP is blank or 0. -----------
  const packSizes = collectPackSizes(candidates);

  // --- Pass 2: price, flag and de-duplicate. --------------------------------
  const byIdentity = new Map<string, number>();
  const rows: SupplierRow[] = [];

  for (const candidate of candidates) {
    const { record, sourceName, category, parsed } = candidate;
    const notes = [...parsed.reviewNotes];

    const unitPrice = numberOrNull(record[COLUMNS.unitPrice]);
    const casePrice = numberOrNull(record[COLUMNS.casePrice]);
    const costPrice = numberOrNull(record[COLUMNS.costPrice]);

    const pack = resolvePackSize(candidate, packSizes);
    if (pack.inferred) {
      stats.inferredPackSize += 1;
      notes.push(
        `Innehåll DFP is 0 — assumed ${pack.units} per stock (${pack.source}).`
      );
    }

    const price = derivePricePerStock({ unitPrice, casePrice, costPrice, units: pack.units });

    if (price.missing) {
      // Imported at 0 kr rather than dropped: the product is real and the store
      // still has to be able to order it. The flag and the 0 make the gap
      // obvious instead of hiding it behind a guessed price.
      stats.missingPrice += 1;
      notes.push("No Inpris in the masterdoc — price per stock set to 0 kr.");
    }

    if (candidate.recategorised) {
      notes.push('Name says nicotine-free but Artikeltyp said "Vitt Snus" — filed as nicotine-free.');
    }

    const row: SupplierRow = {
      brand: parsed.brand,
      flavor: parsed.flavor,
      strength: parsed.strength,
      format: parsed.format,
      pricePerStock: price.value,
      sku: text(record[COLUMNS.sku]) || null,
      category,
      manufacturerCode: text(record[COLUMNS.manufacturerCode]) || null,
      supplier: text(record[COLUMNS.supplier]) || null,
      unitsPerStock: pack.units,
      unitPrice,
      casePrice,
      costPrice,
      eanKfp: eanText(record[COLUMNS.eanKfp]),
      eanDfp: eanText(record[COLUMNS.eanDfp]),
      stockMin: intOrNull(record[COLUMNS.stockMin]),
      stockMax: intOrNull(record[COLUMNS.stockMax]),
      sourceName,
      needsReview:
        parsed.needsReview || price.missing || candidate.recategorised || pack.weakInference,
      reviewNotes: notes.length > 0 ? notes.join(" ") : null,
    };

    const identity = `${row.brand}|${row.flavor}|${row.strength}|${row.format}`.toLowerCase();
    const existingIndex = byIdentity.get(identity);

    if (existingIndex !== undefined) {
      // Two source articles that parse to the same variant. Keep the later one
      // but flag both names so the duplicate can be resolved by hand.
      const previous = rows[existingIndex];
      stats.mergedDuplicates += 1;
      row.needsReview = true;
      row.reviewNotes = [
        row.reviewNotes,
        `Same parsed variant as "${previous.sourceName}" (art.nr ${previous.sku ?? "?"}) — only one was kept.`,
      ]
        .filter(Boolean)
        .join(" ");
      rows[existingIndex] = row;
      continue;
    }

    byIdentity.set(identity, rows.length);
    rows.push(row);
  }

  for (const row of rows) {
    stats.byCategory[row.category] = (stats.byCategory[row.category] ?? 0) + 1;
    if (row.needsReview) stats.needsReview += 1;
  }

  return { rows, stats, problems };
}

type PackSizeIndex = {
  byBrand: Map<string, number>;
  byCategory: Map<string, number>;
  overall: number | null;
};

/**
 * Most common pack size per brand, per category, and overall. 54 rows in the
 * 2026-09-14 file have Innehåll DFP = 0, and the brand's own other articles are
 * a far better answer than assuming a single can — XQS Virgin Peppermint is
 * 27 kr a can and 270 kr a stock, and 34 other XQS rows say 10.
 */
function collectPackSizes(
  candidates: { parsed: { brand: string }; category: string; units: number | null }[]
): PackSizeIndex {
  const brandCounts = new Map<string, Map<number, number>>();
  const categoryCounts = new Map<string, Map<number, number>>();
  const overallCounts = new Map<number, number>();

  const bump = (map: Map<number, number>, units: number) =>
    map.set(units, (map.get(units) ?? 0) + 1);

  for (const candidate of candidates) {
    if (!candidate.units) continue;

    if (!brandCounts.has(candidate.parsed.brand)) brandCounts.set(candidate.parsed.brand, new Map());
    bump(brandCounts.get(candidate.parsed.brand)!, candidate.units);

    if (!categoryCounts.has(candidate.category)) categoryCounts.set(candidate.category, new Map());
    bump(categoryCounts.get(candidate.category)!, candidate.units);

    bump(overallCounts, candidate.units);
  }

  const mode = (counts: Map<number, number>): number | null => {
    let best: number | null = null;
    let bestCount = 0;
    for (const [units, count] of counts) {
      if (count > bestCount) {
        best = units;
        bestCount = count;
      }
    }
    return best;
  };

  return {
    byBrand: new Map(
      [...brandCounts.entries()].flatMap(([brand, counts]) => {
        const value = mode(counts);
        return value === null ? [] : [[brand, value] as [string, number]];
      })
    ),
    byCategory: new Map(
      [...categoryCounts.entries()].flatMap(([category, counts]) => {
        const value = mode(counts);
        return value === null ? [] : [[category, value] as [string, number]];
      })
    ),
    overall: mode(overallCounts),
  };
}

function resolvePackSize(
  candidate: { parsed: { brand: string }; category: string; units: number | null },
  index: PackSizeIndex
): { units: number; inferred: boolean; source: string; weakInference: boolean } {
  if (candidate.units) {
    return { units: candidate.units, inferred: false, source: "", weakInference: false };
  }

  const fromBrand = index.byBrand.get(candidate.parsed.brand);
  if (fromBrand) {
    return {
      units: fromBrand,
      inferred: true,
      source: `same as other ${candidate.parsed.brand} articles`,
      weakInference: false,
    };
  }

  // No other article from this brand states a pack size, so fall back to the
  // category and then the catalogue. That is a weaker guess about money, so
  // the row is flagged for review as well as noted.
  const fromCategory = index.byCategory.get(candidate.category);
  if (fromCategory) {
    return {
      units: fromCategory,
      inferred: true,
      source: `most common for ${candidate.category}`,
      weakInference: true,
    };
  }

  if (index.overall) {
    return {
      units: index.overall,
      inferred: true,
      source: "most common in the file",
      weakInference: true,
    };
  }

  return { units: 1, inferred: true, source: "no data — priced per can", weakInference: true };
}

function derivePricePerStock(input: {
  unitPrice: number | null;
  casePrice: number | null;
  costPrice: number | null;
  units: number;
}): { value: number; missing: boolean } {
  const base =
    PRICE_BASIS === "cost"
      ? input.costPrice
      : PRICE_BASIS === "case"
        ? (input.casePrice ?? input.unitPrice)
        : input.unitPrice;

  if (base === null || !Number.isFinite(base) || base <= 0) {
    return { value: 0, missing: true };
  }

  return { value: Math.round(base * input.units * 100) / 100, missing: false };
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * EANs must not go through the usual number path — a 13-digit code read as a
 * float stringifies fine, but anything larger would turn into scientific
 * notation. Formatting with no exponent keeps them as the digits they are.
 */
function eanText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  const asText = String(value).trim();
  return asText || null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
}
