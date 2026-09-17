import Link from "next/link";
import StorePicker from "@/components/StorePicker";
import { formatDateTime, formatNumber, formatSek } from "@/lib/format";
import { resolveOrderingStore } from "@/lib/current-store";
import { listOrders } from "@/lib/repositories/orders";
import { canAccessAllStores } from "@/lib/roles";
import { requireUser, storesForUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RecentOrdersPage() {
  const user = await requireUser("/orders");
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
        {isAdmin ? <span className="text-zinc-400"> · {stores.length} butiker</span> : null}
      </p>

      {orders.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga beställningar än.{" "}
          <Link href="/" className="underline underline-offset-4">
            Gör den första
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{formatDateTime(order.submittedAt)}</p>
                <p className="text-sm text-zinc-500 tabular-nums">
                  {isAdmin ? <span className="text-zinc-700">{order.storeName} · </span> : null}
                  {formatNumber(order.totalQuantity)} stockar · {order.lineCount} rader ·{" "}
                  {formatSek(order.totalSek)}
                </p>
                {order.placedByEmail ? (
                  <p className="truncate text-xs text-zinc-400">{order.placedByEmail}</p>
                ) : null}
              </div>
              <a
                href={`/api/orders/${order.id}/export`}
                className="flex h-11 shrink-0 items-center rounded-xl border border-zinc-200 px-4 text-sm font-medium transition hover:bg-zinc-50"
              >
                Excel
              </a>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/"
        className="mt-6 flex h-12 items-center justify-center rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.98]"
      >
        Ny beställning
      </Link>
    </main>
  );
}
