import { NextResponse } from "next/server";
import { stockholmDateKey } from "@/lib/checklists";
import { getBrandSales } from "@/lib/repositories/sales";
import { salesStatsEnabled } from "@/lib/sales";
import { toGranularity } from "@/lib/sales/aggregate";
import { buildSalesWorkbook, salesFileName } from "@/lib/sales-excel";
import { rangeFor, toPeriod } from "@/lib/sales-periods";
import { getSupplierUser } from "@/lib/supplier-session";

export const runtime = "nodejs";

/**
 * The supplier's own figures as a file.
 *
 * The brand comes from the session, exactly as on the page. A route handler
 * has no layout to protect it, so the session check is here and the query
 * string decides nothing except which dates.
 */
export async function GET(request: Request) {
  if (!salesStatsEnabled()) {
    return NextResponse.json({ error: "Statistik är inte påslaget." }, { status: 404 });
  }

  const supplier = await getSupplierUser();
  if (!supplier) {
    return NextResponse.json({ error: "Du måste vara inloggad." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const range = rangeFor({
    period: toPeriod(params.get("period")),
    today: stockholmDateKey(),
    from: params.get("fran"),
    to: params.get("till"),
  });

  const rows = await getBrandSales({
    brandId: supplier.brand.id,
    from: range.from,
    to: range.to,
  });

  const workbook = buildSalesWorkbook({
    rows,
    granularity: toGranularity(params.get("gran")),
    brandName: supplier.brand.name,
    from: range.from,
    to: range.to,
  });

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${salesFileName(supplier.brand.name, range.from, range.to)}"`,
      "cache-control": "no-store",
    },
  });
}
