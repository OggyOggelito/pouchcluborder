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
