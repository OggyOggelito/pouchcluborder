import * as XLSX from "xlsx";
import { byProduct, byStore, overTime, type Granularity, type SalesRow } from "@/lib/sales/aggregate";

/**
 * The supplier's own figures as a workbook.
 *
 * Three sheets, the same three sections as the page. Built from the rows the
 * caller already scoped to one brand — this function has no idea what a brand
 * is, which means it cannot widen a query by accident.
 */
export function buildSalesWorkbook(input: {
  rows: SalesRow[];
  granularity: Granularity;
  brandName: string;
  from: string;
  to: string;
}): Buffer {
  const workbook = XLSX.utils.book_new();

  const money = (value: number | null) => (value === null ? "" : value);

  const period = [
    ["Period", "Sålda", "Försäljning (SEK)"],
    ...overTime(input.rows, input.granularity).map((bucket) => [
      bucket.label,
      bucket.quantity,
      money(bucket.amount),
    ]),
  ];
  const products = [
    ["Produkt", "Sålda", "Försäljning (SEK)"],
    ...byProduct(input.rows).map((bucket) => [bucket.label, bucket.quantity, money(bucket.amount)]),
  ];
  const stores = [
    ["Butik", "Sålda", "Försäljning (SEK)"],
    ...byStore(input.rows).map((bucket) => [bucket.label, bucket.quantity, money(bucket.amount)]),
  ];

  for (const [name, rows] of [
    ["Period", period],
    ["Produkter", products],
    ["Butiker", stores],
  ] as const) {
    const sheet = XLSX.utils.aoa_to_sheet(rows as (string | number)[][]);
    sheet["!cols"] = [{ wch: 34 }, { wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function salesFileName(brandName: string, from: string, to: string): string {
  const slug = brandName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `forsaljning-${slug || "varumarke"}-${from}-${to}.xlsx`;
}
