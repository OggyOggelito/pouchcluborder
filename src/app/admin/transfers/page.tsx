import Link from "next/link";
import TransferCard from "@/components/TransferCard";
import { TRANSFER_STATUSES, TRANSFER_STATUS_LABELS, isTransferStatus } from "@/lib/transfers";
import { listAllTransfers } from "@/lib/repositories/transfers";
import { listStores } from "@/lib/repositories/stores";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; store?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const status = isTransferStatus(params.status) ? params.status : undefined;
  const storeId = params.store || undefined;

  const [transfers, stores] = await Promise.all([
    listAllTransfers({ status, storeId }),
    listStores(),
  ]);

  const chip = (active: boolean) =>
    `min-h-tap shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-[2.75rem] ${
      active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600"
    }`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Överföringar</h1>
      <p className="mt-1 text-zinc-600">{transfers.length} överföringar.</p>

      <div className="mt-4 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href={`/admin/transfers${storeId ? `?store=${storeId}` : ""}`} className={chip(!status)}>
            Alla status
          </Link>
          {TRANSFER_STATUSES.map((candidate) => (
            <Link
              key={candidate}
              href={`/admin/transfers?status=${candidate}${storeId ? `&store=${storeId}` : ""}`}
              className={chip(status === candidate)}
            >
              {TRANSFER_STATUS_LABELS[candidate]}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href={`/admin/transfers${status ? `?status=${status}` : ""}`} className={chip(!storeId)}>
            Alla butiker
          </Link>
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/admin/transfers?store=${store.id}${status ? `&status=${status}` : ""}`}
              className={chip(storeId === store.id)}
            >
              {store.name}
            </Link>
          ))}
        </div>
      </div>

      {transfers.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga överföringar matchar filtren.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {transfers.map((transfer) => (
            <li key={transfer.id}>
              <TransferCard transfer={transfer} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
