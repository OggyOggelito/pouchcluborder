import { NextResponse } from "next/server";
import { createOrder, OrderValidationError } from "@/lib/repositories/orders";

export const runtime = "nodejs";

type Payload = {
  storeId?: unknown;
  note?: unknown;
  lines?: unknown;
};

export async function POST(request: Request) {
  let body: Payload;

  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  if (typeof body.storeId !== "string" || !body.storeId) {
    return NextResponse.json({ error: "Butik saknas." }, { status: 400 });
  }

  if (!Array.isArray(body.lines)) {
    return NextResponse.json({ error: "Orderrader saknas." }, { status: 400 });
  }

  const lines = body.lines.flatMap((line) => {
    if (typeof line !== "object" || line === null) return [];
    const { productId, quantity } = line as { productId?: unknown; quantity?: unknown };
    if (typeof productId !== "string" || typeof quantity !== "number") return [];
    return [{ productId, quantity: Math.trunc(quantity) }];
  });

  try {
    const order = await createOrder({
      storeId: body.storeId,
      lines,
      note: typeof body.note === "string" ? body.note : null,
    });
    return NextResponse.json({ id: order.id }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to create order", error);
    return NextResponse.json({ error: "Kunde inte spara beställningen." }, { status: 500 });
  }
}
