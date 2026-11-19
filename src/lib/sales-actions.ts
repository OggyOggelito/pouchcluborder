"use server";

import { revalidatePath } from "next/cache";
import { importSales, resolveUnmatched } from "@/lib/repositories/sales";
import { parseSalesCsv } from "@/lib/sales/csv";
import { EMPTY_IMPORT, type ImportState } from "@/lib/sales-import-state";
import { requireStatsUser } from "@/lib/session";

/**
 * Importing sales, and tying up the rows that did not match.
 *
 * Behind `requireStatsUser`, which is the ADMIN role *and* the per-account
 * permission — the same gate as reading the figures, because uploading a file
 * is the fastest way to see them.
 */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function importSalesAction(
  _state: ImportState,
  formData: FormData
): Promise<ImportState> {
  const user = await requireStatsUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...EMPTY_IMPORT, error: "Välj en fil." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ...EMPTY_IMPORT, error: "Filen är för stor (max 8 MB)." };
  }

  const text = await file.text();
  const parsed = parseSalesCsv(text);

  if (parsed.lines.length === 0) {
    return {
      ...EMPTY_IMPORT,
      error: "Inga rader kunde läsas.",
      problems: parsed.errors.slice(0, 10).map((row) => `Rad ${row.line}: ${row.message}`),
    };
  }

  const result = await importSales({
    lines: parsed.lines,
    source: "manual",
    fileName: file.name,
    createdById: user.id,
  });

  revalidatePath("/admin/stats");
  return {
    error: null,
    summary: {
      rowsRead: result.rowsRead,
      rowsStored: result.rowsStored,
      rowsUnmatched: result.rowsUnmatched,
      unknownStores: result.unknownStores,
      from: result.from,
      to: result.to,
    },
    // Parse errors are shown even on a successful import: a file that lost
    // forty rows to a bad date column still "worked", and that is exactly the
    // case somebody needs to see.
    problems: parsed.errors.slice(0, 10).map((row) => `Rad ${row.line}: ${row.message}`),
  };
}

export async function resolveUnmatchedAction(formData: FormData): Promise<void> {
  await requireStatsUser();

  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!id || !productId) return;

  await resolveUnmatched({ id, productId });
  revalidatePath("/admin/stats");
}
