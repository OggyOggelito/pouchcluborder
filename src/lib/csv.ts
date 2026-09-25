import { normalizeFormat, normalizeStrength, parsePrice } from "@/lib/catalog";
import type { ProductInput } from "@/lib/repositories/products";

export type CsvRowError = { line: number; message: string };

export type CsvParseResult = {
  rows: ProductInput[];
  errors: CsvRowError[];
  /** Header names found in the file, for error messages in the UI. */
  headers: string[];
};

// Accepts the English column names from the spec plus the Swedish equivalents a
// Shopify export is likely to carry.
const COLUMN_ALIASES: Record<keyof ProductInput, string[]> = {
  brand: ["brand", "märke", "marke", "varumärke", "varumarke", "vendor"],
  flavor: ["flavor", "flavour", "smak", "name", "namn", "title", "produkt"],
  strength: ["strength", "styrka", "nikotin", "nikotinhalt", "mg"],
  format: ["format", "storlek", "size", "typ"],
  pricePerStock: [
    "pricePerStock",
    "price_per_stock",
    "price per stock",
    "price",
    "pris",
    "stockpris",
    "pris per stock",
  ],
};

export function parseProductCsv(text: string): CsvParseResult {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!clean) {
    return { rows: [], errors: [{ line: 0, message: "The file is empty." }], headers: [] };
  }

  const delimiter = detectDelimiter(clean);
  const records = parseDelimited(clean, delimiter);

  if (records.length === 0) {
    return { rows: [], errors: [{ line: 0, message: "The file is empty." }], headers: [] };
  }

  const headers = records[0].map((header) => header.trim());
  const index = mapColumns(headers);

  const missing = (Object.keys(COLUMN_ALIASES) as (keyof ProductInput)[]).filter(
    (column) => index[column] === undefined && column !== "format"
  );

  if (missing.length > 0) {
    return {
      rows: [],
      headers,
      errors: [
        {
          line: 1,
          message: `Missing required column(s): ${missing.join(", ")}. Found: ${headers.join(", ")}.`,
        },
      ],
    };
  }

  const rows: ProductInput[] = [];
  const errors: CsvRowError[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < records.length; i += 1) {
    const record = records[i];
    const lineNumber = i + 1;

    if (record.every((cell) => cell.trim() === "")) continue;

    const brand = cell(record, index.brand).trim();
    const flavor = cell(record, index.flavor).trim();
    const strength = normalizeStrength(cell(record, index.strength));
    const format = normalizeFormat(cell(record, index.format), flavor);
    const pricePerStock = parsePrice(cell(record, index.pricePerStock));

    if (!brand) {
      errors.push({ line: lineNumber, message: "Missing brand." });
      continue;
    }
    if (!flavor) {
      errors.push({ line: lineNumber, message: `Missing flavor (${brand}).` });
      continue;
    }
    if (!strength) {
      errors.push({ line: lineNumber, message: `Missing strength (${brand} ${flavor}).` });
      continue;
    }
    if (pricePerStock === null) {
      errors.push({
        line: lineNumber,
        message: `Invalid price "${cell(record, index.pricePerStock)}" (${brand} ${flavor}).`,
      });
      continue;
    }

    const key = `${brand}|${flavor}|${strength}|${format}`.toLowerCase();
    if (seen.has(key)) {
      errors.push({
        line: lineNumber,
        message: `Duplicate of an earlier row (${brand} ${flavor} ${strength} ${format}) — the later row wins.`,
      });
      // Keep the newest price by replacing the earlier occurrence.
      const existingIndex = rows.findIndex(
        (row) =>
          `${row.brand}|${row.flavor}|${row.strength}|${row.format}`.toLowerCase() === key
      );
      if (existingIndex >= 0) rows[existingIndex] = { brand, flavor, strength, format, pricePerStock };
      continue;
    }

    seen.add(key);
    rows.push({ brand, flavor, strength, format, pricePerStock });
  }

  return { rows, errors, headers };
}

function cell(record: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return record[index] ?? "";
}

function mapColumns(headers: string[]): Partial<Record<keyof ProductInput, number>> {
  const normalized = headers.map((header) => header.toLowerCase().trim());
  const index: Partial<Record<keyof ProductInput, number>> = {};

  for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as [
    keyof ProductInput,
    string[]
  ][]) {
    const found = normalized.findIndex((header) =>
      aliases.some((alias) => alias.toLowerCase() === header)
    );
    if (found >= 0) index[column] = found;
  }

  return index;
}

/** Exported so the shift import reuses the same delimiter handling. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split("\n", 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((candidate) => ({
    candidate,
    count: firstLine.split(candidate).length - 1,
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].candidate : ",";
}

/** Minimal RFC 4180 reader: quoted fields, "" escapes, newlines inside quotes. */
/** Exported so the shift import reuses the same quoting/BOM handling. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  record.push(field);
  records.push(record);

  return records;
}
