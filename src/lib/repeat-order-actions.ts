"use server";

import { redirect } from "next/navigation";
import { getOrder } from "@/lib/repositories/orders";
import { saveDraft } from "@/lib/repositories/order-drafts";
import { pruneToCatalog, type DraftLines } from "@/lib/order-drafts";
import { prisma } from "@/lib/db";
import { canOrderForStore, requireOrderingUser } from "@/lib/session";

/**
 * "Beställ samma igen" — loads a past order into the draft for its store and
 * opens the order form.
 *
 * A draft rather than a new order: the point is to save the typing, not to
 * send something nobody looked at. Whoever repeats it still reviews and
 * presses send.
 *
 * Lines whose product has since left the catalog are dropped here, so a
 * repeat of a six-month-old order opens with what can actually be ordered
 * rather than failing at submit.
 */
export async function repeatOrderAction(formData: FormData) {
  const user = await requireOrderingUser("/orders");

  const orderId = String(formData.get("orderId") ?? "");
  const order = await getOrder(orderId);
  if (!order) throw new Error("Okänd beställning.");

  if (!(await canOrderForStore(user, order.store.id))) {
    throw new Error("Du har inte tillgång till den butiken.");
  }

  const active = await prisma.product.findMany({
    where: { active: true, id: { in: order.lines.map((line) => line.productId) } },
    select: { id: true },
  });

  const wanted: DraftLines = {};
  for (const line of order.lines) wanted[line.productId] = line.quantity;
  const { lines } = pruneToCatalog(
    wanted,
    active.map((product) => product.id)
  );

  // clientVersion 0: this replaces whatever draft was there, which is what
  // "order the same again" means. Anything half-typed would have been
  // autosaved, so the person can still see it in the order history.
  await saveDraft({
    userId: user.id,
    storeId: order.store.id,
    lines,
    note: null,
    clientVersion: 0,
  });

  redirect(`/order?store=${order.store.id}`);
}
