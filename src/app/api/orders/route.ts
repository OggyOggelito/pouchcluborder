import { NextResponse } from "next/server";
import { createOrder, OrderValidationError } from "@/lib/repositories/orders";
import { canOrderForStore, getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

type Payload = {
  storeId?: unknown;
  note?: unknown;
  lines?: unknown;
};

export async function POST(request: Request) {
  // Checked here as well as in proxy.ts: proxy only sees whether a cookie
  // exists, and an API route must not take that as proof of anything.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Du måste vara inloggad." }, { status: 401 });
  }

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

  // The store comes from the browser, so it is checked against the account
  // rather than trusted — otherwise any signed-in owner could post an order
  // against another store's id.
  if (!(await canOrderForStore(user, body.storeId))) {
    return NextResponse.json({ error: "Du har inte tillgång till den butiken." }, { status: 403 });
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
      placedByUserId: user.id,
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
