import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOrder, OrderValidationError } from "@/lib/repositories/orders";
import { deleteDraft } from "@/lib/repositories/order-drafts";
import { activePausesFor, recordOverride } from "@/lib/repositories/order-pause";
import { describePause } from "@/lib/order-pause";
import { canOrderForStore, getSessionUser } from "@/lib/session";
import { canOverrideOrderPause, canPlaceOrders } from "@/lib/roles";

export const runtime = "nodejs";

type Payload = {
  storeId?: unknown;
  note?: unknown;
  lines?: unknown;
  /** An ADMIN pushing an order through a pause. Required, and logged. */
  overrideReason?: unknown;
};

export async function POST(request: Request) {
  // Checked here as well as in proxy.ts: proxy only sees whether a cookie
  // exists, and an API route must not take that as proof of anything.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Du måste vara inloggad." }, { status: 401 });
  }
  // STAFF may read the guide and their own schedule, but not order.
  if (!canPlaceOrders(user.role)) {
    return NextResponse.json({ error: "Din roll kan inte lägga beställningar." }, { status: 403 });
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

  // Ordering may be paused. Checked here rather than only in the form: the
  // form is a convenience and this is the door. A pause on one brand only
  // bites when the basket actually contains it, so the brands in the basket
  // are part of the question.
  const brandIds = await brandsInBasket(lines.map((line) => line.productId));
  const pauses = await activePausesFor({ storeId: body.storeId, brandIds });

  const overrideReason =
    typeof body.overrideReason === "string" ? body.overrideReason.trim() : "";

  if (pauses.length > 0) {
    const mayOverride = canOverrideOrderPause(user.role);

    if (!mayOverride || overrideReason.length === 0) {
      return NextResponse.json(
        {
          error: pauses.map(describePause).join(" "),
          paused: true,
          // Tells the form whether to offer the override box at all.
          mayOverride,
        },
        { status: 409 }
      );
    }
  }

  try {
    const order = await createOrder({
      storeId: body.storeId,
      lines,
      note: typeof body.note === "string" ? body.note : null,
      placedByUserId: user.id,
    });
    // The basket became an order, so the draft has done its job. Dropped
    // server-side rather than trusting the client to clean up: a browser that
    // closes on the confirmation screen would otherwise leave the "Fortsätt
    // beställning" card pointing at an order already sent.
    await deleteDraft(user.id, body.storeId);

    // Logged after the order exists, so the record points at a real order.
    for (const pause of pauses) {
      await recordOverride({
        pauseId: pause.id,
        userId: user.id,
        storeId: body.storeId,
        orderId: order.id,
        reason: overrideReason,
      });
    }

    return NextResponse.json({ id: order.id }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to create order", error);
    return NextResponse.json({ error: "Kunde inte spara beställningen." }, { status: 500 });
  }
}

/** The brands a basket touches, for brand-scoped pauses. */
async function brandsInBasket(productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { brandId: true },
  });
  return [...new Set(products.flatMap((product) => (product.brandId ? [product.brandId] : [])))];
}
