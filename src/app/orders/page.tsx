import Link from "next/link";
import StorePicker from "@/components/StorePicker";
import { formatDateTime, formatNumber, formatSek } from "@/lib/format";
import { getCurrentStore } from "@/lib/current-store";
import { listOrdersForStore } from "@/lib/repositories/orders";
import { listStores } from "@/lib/repositories/stores";

export const dynamic = "force-dynamic";

export default async function RecentOrdersPage() {
  const store = await getCurrentStore();

  if (!store) {
    return <StorePicker stores={await listStores()} />;
  }

  const orders = await listOrdersForStore(store.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold tracking-tight">Tidigare beställningar</h1>
      <p className="mt-1 text-zinc-600">{store.name}</p>

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
                  {formatNumber(order.totalQuantity)} stockar · {order.lineCount} rader ·{" "}
                  {formatSek(order.totalSek)}
                </p>
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
