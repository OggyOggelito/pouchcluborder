import Link from "next/link";
import TransferCard from "@/components/TransferCard";
import { NO_RESERVATION_NOTICE } from "@/lib/transfers";
import { listTransfersForStores, type TransferTab } from "@/lib/repositories/transfers";
import { canAccessAllStores, canPlaceOrders } from "@/lib/roles";
import { listStores } from "@/lib/repositories/stores";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS: { id: TransferTab; label: string }[] = [
  { id: "incoming", label: "Inkomna" },
  { id: "outgoing", label: "Skickade" },
  { id: "history", label: "Historik" },
];

/** STAFF may read their store's transfers but not create or change them. */
export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser("/transfers");
  const { tab: tabParam } = await searchParams;
  const tab = (TABS.find((candidate) => candidate.id === tabParam)?.id ?? "incoming") as TransferTab;

  // Scope from the account, never the query string.
  const stores = canAccessAllStores(user.role) ? await listStores() : user.stores;
  const transfers = await listTransfersForStores(stores.map((store) => store.id), tab);

  const mayCreate = canPlaceOrders(user.role);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Överföringar</h1>
        {mayCreate ? (
          <Link href="/transfers/new" className="text-sm font-medium underline underline-offset-4">
            Ny förfrågan
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-500">{NO_RESERVATION_NOTICE}</p>

      <div className="mt-4 flex gap-2">
        {TABS.map((candidate) => (
          <Link
            key={candidate.id}
            href={`/transfers?tab=${candidate.id}`}
            className={`h-10 flex-1 rounded-full border text-center text-sm font-medium leading-[2.5rem] ${
              candidate.id === tab
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600"
            }`}
          >
            {candidate.label}
          </Link>
        ))}
      </div>

      {!mayCreate ? (
        <p className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-600">
          Du kan följa butikens överföringar här. Det är butiksansvarig som skapar och svarar
          på förfrågningar.
        </p>
      ) : null}

      {transfers.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inget här just nu.
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
