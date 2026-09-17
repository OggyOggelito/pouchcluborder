import { buildOrderWorkbook, orderFileName } from "@/lib/excel";
import { getOrder } from "@/lib/repositories/orders";
import { canOrderForStore, getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return new Response("Order not found", { status: 404 });
  }

  // An OWNER may only export their own store's orders. 404 rather than 403, so
  // this cannot be used to discover which order ids exist.
  if (!(await canOrderForStore(user, order.store.id))) {
    return new Response("Order not found", { status: 404 });
  }

  const workbook = buildOrderWorkbook(order);

  return new Response(new Uint8Array(workbook), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${orderFileName(order)}"`,
      "cache-control": "no-store",
    },
  });
}
