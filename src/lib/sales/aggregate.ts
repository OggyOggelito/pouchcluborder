/**
 * Turning daily rows into the figures a page shows.
 *
 * Pure. Every number a supplier reads comes out of this file, so the maths has
 * one home and one set of tests rather than a `reduce` on each page.
 *
 * Money is `number | null` throughout, and null means "the source did not
 * report money", never zero. A provider that only reports units is still
 * useful, and a 0 kr next to 40 sold cans would be a lie.
 */
import { isoWeekKey } from "@/lib/schedule/time";

export type SalesRow = {
  date: string;
  storeId: string;
  storeName: string;
  productId: string;
  flavor: string;
  strength: string;
  format: string;
  quantity: number;
  amount: number | null;
};

export type Bucket = {
  key: string;
  label: string;
  quantity: number;
  /** Null when no row in the bucket reported money. */
  amount: number | null;
};

export type Granularity = "day" | "week" | "month";

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "Per dag",
  week: "Per vecka",
  month: "Per månad",
};

export function toGranularity(value: unknown): Granularity {
  return value === "week" || value === "month" ? value : "day";
}

function addMoney(current: number | null, next: number | null): number | null {
  if (next === null) return current;
  return (current ?? 0) + next;
}

function bucketBy(
  rows: SalesRow[],
  keyOf: (row: SalesRow) => string,
  labelOf: (key: string, row: SalesRow) => string
): Bucket[] {
  const map = new Map<string, Bucket>();

  for (const row of rows) {
    const key = keyOf(row);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += row.quantity;
      existing.amount = addMoney(existing.amount, row.amount);
      continue;
    }
    map.set(key, {
      key,
      label: labelOf(key, row),
      quantity: row.quantity,
      amount: row.amount,
    });
  }

  return [...map.values()];
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** Chronological buckets for the trend, at the chosen grain. */
export function overTime(rows: SalesRow[], granularity: Granularity): Bucket[] {
  const buckets =
    granularity === "day"
      ? bucketBy(rows, (row) => row.date, (key) => key)
      : granularity === "week"
        ? bucketBy(rows, (row) => isoWeekKey(row.date), (key) => `v. ${key.slice(-2)}`)
        : bucketBy(rows, (row) => row.date.slice(0, 7), (key) => monthLabel(key));

  return buckets.sort((a, b) => a.key.localeCompare(b.key));
}

/** Biggest first — what a supplier opens the page to find out. */
export function byProduct(rows: SalesRow[]): Bucket[] {
  return bucketBy(
    rows,
    (row) => row.productId,
    (_key, row) => `${row.flavor} ${row.strength} ${row.format}`.trim()
  ).sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label, "sv"));
}

export function byStore(rows: SalesRow[]): Bucket[] {
  return bucketBy(rows, (row) => row.storeId, (_key, row) => row.storeName).sort(
    (a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label, "sv")
  );
}

export type Totals = {
  quantity: number;
  amount: number | null;
  /** True when at least one row reported no money, so the sum is partial. */
  amountPartial: boolean;
  days: number;
  products: number;
  stores: number;
};

export function totals(rows: SalesRow[]): Totals {
  let quantity = 0;
  let amount: number | null = null;
  let missingMoney = false;

  const days = new Set<string>();
  const products = new Set<string>();
  const stores = new Set<string>();

  for (const row of rows) {
    quantity += row.quantity;
    amount = addMoney(amount, row.amount);
    if (row.amount === null) missingMoney = true;
    days.add(row.date);
    products.add(row.productId);
    stores.add(row.storeId);
  }

  return {
    quantity,
    amount,
    amountPartial: missingMoney && amount !== null,
    days: days.size,
    products: products.size,
    stores: stores.size,
  };
}

export function topProducts(rows: SalesRow[], limit = 5): Bucket[] {
  return byProduct(rows).slice(0, limit);
}

/**
 * How one period compares with the one before it.
 *
 * Returns null rather than a percentage when the earlier period sold nothing:
 * "+∞ %" and "+100 %" are both nonsense, and no figure is the honest answer.
 */
export function changeRatio(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

/** "+12 %" / "−4 %" / "—". */
export function formatChange(ratio: number | null): string {
  if (ratio === null) return "—";
  const percent = Math.round(ratio * 100);
  if (percent === 0) return "0 %";
  return `${percent > 0 ? "+" : "−"}${Math.abs(percent)} %`;
}
