import * as XLSX from "xlsx";
import type { OrderDetail } from "@/lib/repositories/orders";
import { slugify } from "@/lib/format";

const HEADERS = [
  "Brand",
  "Flavor",
  "Strength",
  "Format",
  "Quantity (stockar)",
  "Unit Price",
  "Line Total",
] as const;

/** Builds the single-sheet .xlsx for one order, ending in a totals row. */
export function buildOrderWorkbook(order: OrderDetail): Buffer {
  const rows: (string | number)[][] = [
    [...HEADERS],
    ...order.lines.map((line) => [
      line.brand,
      line.flavor,
      line.strength,
      line.format,
      line.quantity,
      line.unitPrice,
      line.lineTotal,
    ]),
    ["TOTAL", "", "", "", order.totalQuantity, "", order.totalSek],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);

  sheet["!cols"] = [
    { wch: 16 },
    { wch: 26 },
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
  ];

  // Currency formatting on the price columns, integer on the quantity column.
  const lastRow = rows.length;
  for (let row = 2; row <= lastRow; row += 1) {
    for (const column of ["F", "G"]) {
      const cell = sheet[`${column}${row}`];
      if (cell && typeof cell.v === "number") cell.z = "#,##0.00 \"kr\"";
    }
    const quantityCell = sheet[`E${row}`];
    if (quantityCell && typeof quantityCell.v === "number") quantityCell.z = "0";
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Order");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function orderFileName(order: OrderDetail): string {
  const date = order.submittedAt.toISOString().slice(0, 10);
  return `pouchclub-${slugify(order.store.name)}-${date}-${order.id.slice(-6)}.xlsx`;
}

/**
 * Customer requests as a one-sheet workbook for purchasing.
 *
 * No prices and no personal data — the model holds neither.
 */
export function buildRequestsWorkbook(
  rows: {
    storeName: string;
    kind: string;
    brandText: string | null;
    flavorText: string | null;
    productLabel: string | null;
    count: number;
    firstSeenAt: Date;
    lastSeenAt: Date;
    status: string;
    statusNote: string | null;
  }[]
): ArrayBuffer {
  const header = [
    "Store",
    "Kind",
    "Brand",
    "Flavor",
    "Linked product",
    "Count",
    "First seen",
    "Last seen",
    "Status",
    "Note",
  ];

  const body = rows.map((row) => [
    row.storeName,
    row.kind,
    row.brandText ?? "",
    row.flavorText ?? "",
    row.productLabel ?? "",
    row.count,
    row.firstSeenAt.toISOString().slice(0, 10),
    row.lastSeenAt.toISOString().slice(0, 10),
    row.status,
    row.statusNote ?? "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet["!cols"] = [
    { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 34 },
    { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 40 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Kundönskemål");
  return XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
