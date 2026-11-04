import Link from "next/link";
import StorePicker from "@/components/StorePicker";
import { formatSek, formatShortDateTime } from "@/lib/format";
import { resolveOrderingStore } from "@/lib/current-store";
import { listOrders } from "@/lib/repositories/orders";
import { canAccessAllStores } from "@/lib/roles";
import { repeatOrderAction } from "@/lib/repeat-order-actions";
import { requireOrderingUser, storesForUser } from "@/lib/session";
import { countOf } from "@/lib/terms";

export const dynamic = "force-dynamic";

export default async function RecentOrdersPage() {
  const user = await requireOrderingUser("/orders");
  const isAdmin = canAccessAllStores(user.role);

  // An ADMIN sees every store's history; an OWNER only the store they are in.
  // `null` is the repository's "no store filter", and is only ever passed here.
  let orders;
  let heading: string;

  if (isAdmin) {
    orders = await listOrders(null);
    heading = "Alla butiker";
  } else {
    const resolution = await resolveOrderingStore(user);

    if (resolution.kind === "none") {
      return (
        <main className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-xl font-semibold tracking-tight">Ingen butik kopplad</h1>
          <p className="mt-2 text-zinc-600">Be en administratör koppla en butik till kontot.</p>
        </main>
      );
    }

    if (resolution.kind === "choose") {
      return <StorePicker stores={resolution.choices} />;
    }

    orders = await listOrders([resolution.store.id]);
    heading = resolution.store.name;
  }

  const stores = await storesForUser(user);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold tracking-tight">Tidigare beställningar</h1>
      <p className="mt-1 text-zinc-600">
        {heading}
        {isAdmin ? <span className="text-zinc-500"> · {stores.length} butiker</span> : null}
      </p>

      {orders.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga beställningar än.{" "}
          <Link href="/order" className="underline underline-offset-4">
            Gör den första
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm"
            >
              <Link href={`/orders/${order.id}`} className="block min-h-tap">
                <p className="font-medium">{formatShortDateTime(order.submittedAt)}</p>
                <p className="text-sm text-zinc-600 tabular-nums">
                  {isAdmin ? <span className="text-zinc-700">{order.storeName} · </span> : null}
                  {countOf("stock", order.totalQuantity)} · {order.lineCount} rader ·{" "}
                  {formatSek(order.totalSek)}
                </p>
                {order.placedByEmail ? (
                  <p className="truncate text-xs text-zinc-600">{order.placedByEmail}</p>
                ) : null}
              </Link>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                {/* One tap to re-order the same thing — the most common
                    restock is "the same as last time". It opens as a draft,
                    so it is still reviewed and sent by a person. */}
                <form action={repeatOrderAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <button
                    type="submit"
                    className="min-h-tap rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition active:scale-[0.98]"
                  >
                    Beställ samma igen
                  </button>
                </form>
                <a
                  href={`/api/orders/${order.id}/export`}
                  className="flex min-h-tap shrink-0 items-center rounded-xl border border-zinc-200 px-4 text-sm font-medium transition hover:bg-zinc-50"
                >
                  Excel
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/order"
        className="mt-6 flex h-12 items-center justify-center rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.98]"
      >
        Ny beställning
      </Link>
    </main>
  );
}
