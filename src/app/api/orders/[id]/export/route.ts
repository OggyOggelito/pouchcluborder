import { buildOrderWorkbook, orderFileName } from "@/lib/excel";
import { getOrder } from "@/lib/repositories/orders";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
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
