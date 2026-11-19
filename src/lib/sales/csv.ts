import type { SalesLine } from "@/lib/sales/types";

/**
 * The sales file an ADMIN uploads.
 *
 * Deliberately forgiving about shape and strict about meaning: the column
 * names may be English or Swedish in any order, the delimiter may be a comma
 * or a semicolon, dates may be written three ways and decimals with a comma —
 * because the file comes out of whatever the stats lead can export today. What
 * it will not do is guess a quantity or invent a date.
 *
 * It produces `SalesLine[]`, the same type the Sharp provider will, so the
 * whole path behind this parser is already in use before that API exists.
 */
export type SalesCsvError = { line: number; message: string };

export type SalesCsvResult = {
  lines: SalesLine[];
  errors: SalesCsvError[];
  headers: string[];
};

const ALIASES: Record<string, string[]> = {
  date: ["date", "datum", "dag", "saledate", "sale_date", "försäljningsdatum"],
  store: ["store", "butik", "butiksnamn", "shop", "storename", "store_name", "enhet"],
  sku: ["sku", "artikelnummer", "artnr", "art.nr", "artnr.", "article", "articleno"],
  ean: ["ean", "streckkod", "barcode", "gtin", "ean13"],
  description: ["description", "benämning", "benamning", "produkt", "name", "namn", "vara"],
  quantity: ["quantity", "antal", "qty", "styck", "st", "sold", "salda", "sålda"],
  amount: ["amount", "belopp", "summa", "försäljning", "forsaljning", "gross", "omsättning"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/^﻿/, "");
}

function columnFor(headers: string[], key: string): number {
  const wanted = ALIASES[key];
  return headers.findIndex((header) => wanted.includes(header));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) return "\t";
  return semicolons >= commas ? ";" : ",";
}

/** Minimal RFC-4180: quoted fields, doubled quotes inside them. */
function splitRow(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      out.push(value);
      value = "";
      continue;
    }
    value += char;
  }
  out.push(value);
  return out.map((field) => field.trim());
}

/** "2026-11-04", "04/11/2026" and "20261104" all mean the same day. */
export function parseDate(value: string): string | null {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isReal(text) ? text : null;

  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (slash) {
    const iso = `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
    return isReal(iso) ? iso : null;
  }

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (compact) {
    const iso = `${compact[1]}-${compact[2]}-${compact[3]}`;
    return isReal(iso) ? iso : null;
  }

  // A timestamp: take the date part and drop the rest. The hour a can was
  // sold is not something this app stores.
  const stamp = /^(\d{4}-\d{2}-\d{2})[T ]/.exec(text);
  if (stamp) return isReal(stamp[1]) ? stamp[1] : null;

  return null;
}

function isReal(iso: string): boolean {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso;
}

/** "1 234,50" and "1234.50" are the same number. */
export function parseNumber(value: string): number | null {
  const text = value.replace(/\s/g, "").replace(/ /g, "");
  if (text === "") return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSalesCsv(text: string): SalesCsvResult {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!clean) {
    return { lines: [], errors: [{ line: 0, message: "Filen är tom." }], headers: [] };
  }

  const delimiter = detectDelimiter(clean);
  const rows = clean.split("\n").filter((row) => row.trim() !== "");
  const headers = splitRow(rows[0], delimiter).map(normalizeHeader);

  const index = {
    date: columnFor(headers, "date"),
    store: columnFor(headers, "store"),
    sku: columnFor(headers, "sku"),
    ean: columnFor(headers, "ean"),
    description: columnFor(headers, "description"),
    quantity: columnFor(headers, "quantity"),
    amount: columnFor(headers, "amount"),
  };

  const errors: SalesCsvError[] = [];
  if (index.date === -1) errors.push({ line: 1, message: "Kolumnen datum saknas." });
  if (index.store === -1) errors.push({ line: 1, message: "Kolumnen butik saknas." });
  if (index.quantity === -1) errors.push({ line: 1, message: "Kolumnen antal saknas." });
  if (index.sku === -1 && index.ean === -1) {
    errors.push({ line: 1, message: "Filen behöver en kolumn med artikelnummer eller EAN." });
  }
  if (errors.length > 0) return { lines: [], errors, headers };

  const lines: SalesLine[] = [];

  for (let row = 1; row < rows.length; row += 1) {
    const fields = splitRow(rows[row], delimiter);
    const at = row + 1;

    const date = parseDate(fields[index.date] ?? "");
    if (!date) {
      errors.push({ line: at, message: `Ogiltigt datum: ${fields[index.date] ?? "(tomt)"}` });
      continue;
    }

    const quantity = parseNumber(fields[index.quantity] ?? "");
    if (quantity === null) {
      errors.push({ line: at, message: `Ogiltigt antal: ${fields[index.quantity] ?? "(tomt)"}` });
      continue;
    }
    // A return shows up as a negative line and is kept: netting it out here
    // would hide it, and whether Sharp reports returns at all is one of the
    // questions in docs/sharp-api-intake.md.
    if (!Number.isInteger(quantity)) {
      errors.push({ line: at, message: `Antal måste vara ett heltal: ${quantity}` });
      continue;
    }

    const storeName = (fields[index.store] ?? "").trim();
    if (!storeName) {
      errors.push({ line: at, message: "Butik saknas." });
      continue;
    }

    lines.push({
      date,
      storeName,
      sku: index.sku === -1 ? null : (fields[index.sku] ?? "").trim() || null,
      ean: index.ean === -1 ? null : (fields[index.ean] ?? "").trim() || null,
      description:
        index.description === -1 ? null : (fields[index.description] ?? "").trim() || null,
      quantity,
      grossAmount: index.amount === -1 ? null : parseNumber(fields[index.amount] ?? ""),
    });
  }

  return { lines, errors, headers };
}
