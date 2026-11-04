import { buildRequestsWorkbook } from "@/lib/excel";
import { toRequestKind } from "@/lib/customer-requests";
import { listRanked } from "@/lib/repositories/customer-requests";
import { canAccessAdmin } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !canAccessAdmin(user.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days")) === 90 ? 90 : 30;
  const storeId = url.searchParams.get("store") ?? undefined;
  const kindParam = url.searchParams.get("kind");

  const rows = await listRanked({
    days,
    storeId,
    kind: kindParam ? toRequestKind(kindParam) : undefined,
  });

  const workbook = buildRequestsWorkbook(rows);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(workbook), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="pouchclub-kundonskemal-${days}d-${date}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
