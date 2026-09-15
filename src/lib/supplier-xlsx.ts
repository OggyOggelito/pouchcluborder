import * as XLSX from "xlsx";
import { ARTIKELTYP_TO_CATEGORY } from "@/lib/categories";
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
    unknownPackSize: number;
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
    unknownPackSize: 0,
    byCategory: {},
    needsReview: 0,
  };
  const problems: { name: string; message: string }[] = [];

  // Identity -> index, so a later row replaces an earlier one that parsed to the
  // same brand/flavor/strength/format instead of blowing up the unique key.
  const byIdentity = new Map<string, number>();
  const rows: SupplierRow[] = [];

  for (const record of raw) {
    if (text(record[COLUMNS.active]) !== "Ja") {
      stats.skippedInactive += 1;
      continue;
    }

    const category = CATEGORY_MAP[text(record[COLUMNS.articleType]).toLowerCase()];
    if (!category) {
      stats.skippedCategory += 1;
      continue;
    }

    const sourceName = text(record[COLUMNS.name]);
    if (!sourceName) {
      stats.skippedUnusable += 1;
      problems.push({ name: "(blank)", message: "Row has no Benämning." });
      continue;
    }

    const unitPrice = numberOrNull(record[COLUMNS.unitPrice]);
    const casePrice = numberOrNull(record[COLUMNS.casePrice]);
    const costPrice = numberOrNull(record[COLUMNS.costPrice]);
    const unitsPerStock = intOrNull(record[COLUMNS.unitsPerStock]);

    const price = derivePricePerStock({ unitPrice, casePrice, costPrice, unitsPerStock });

    const parsed = parseProductName(sourceName, category);
    const notes = [...parsed.reviewNotes];

    if (price.unknownPackSize && !price.missing) {
      stats.unknownPackSize += 1;
      notes.push("Innehåll DFP is 0 — priced per can, not per stock.");
    }

    if (price.missing) {
      // Imported at 0 kr rather than dropped: the product is real and the store
      // still has to be able to order it. The flag and the 0 make the gap
      // obvious instead of hiding it behind a guessed price.
      stats.missingPrice += 1;
      notes.push("No Inpris in the masterdoc — price per stock set to 0 kr.");
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
      unitsPerStock,
      unitPrice,
      casePrice,
      costPrice,
      eanKfp: eanText(record[COLUMNS.eanKfp]),
      eanDfp: eanText(record[COLUMNS.eanDfp]),
      stockMin: intOrNull(record[COLUMNS.stockMin]),
      stockMax: intOrNull(record[COLUMNS.stockMax]),
      sourceName,
      needsReview: parsed.needsReview || price.missing || price.unknownPackSize,
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

function derivePricePerStock(input: {
  unitPrice: number | null;
  casePrice: number | null;
  costPrice: number | null;
  unitsPerStock: number | null;
}): { value: number; missing: boolean; unknownPackSize: boolean } {
  // Innehåll DFP is 0 on some rows — the pack size simply is not stated. Price
  // the row per can rather than inventing a pack size, and flag it, because a
  // stock of these would otherwise be billed at a tenth of the real cost.
  const unknownPackSize = !input.unitsPerStock || input.unitsPerStock <= 0;
  const units = unknownPackSize ? 1 : input.unitsPerStock!;

  const base =
    PRICE_BASIS === "cost"
      ? input.costPrice
      : PRICE_BASIS === "case"
        ? (input.casePrice ?? input.unitPrice)
        : input.unitPrice;

  if (base === null || !Number.isFinite(base) || base <= 0) {
    return { value: 0, missing: true, unknownPackSize };
  }

  return { value: Math.round(base * units * 100) / 100, missing: false, unknownPackSize };
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
