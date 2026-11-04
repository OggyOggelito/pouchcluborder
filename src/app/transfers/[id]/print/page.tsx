import { notFound } from "next/navigation";
import { TRANSFER_UNIT_LABELS } from "@/lib/transfers";
import { getTransfer } from "@/lib/repositories/transfers";
import { canAccessAdmin } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("sv-SE", { dateStyle: "long", timeZone: "Europe/Stockholm" });

/**
 * Följesedel — goes in the box.
 *
 * Deliberately no prices: a transfer is coordination between two of our own
 * stores, not a sale.
 */
export default async function TransferPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("/transfers");
  const { id } = await params;

  const transfer = await getTransfer(id);
  if (!transfer) notFound();

  const ownStoreIds = user.stores.map((store) => store.id);
  const involved = [
    transfer.requestingStore.id,
    transfer.targetStore?.id,
    transfer.acceptingStore?.id,
  ].filter(Boolean) as string[];

  if (!canAccessAdmin(user.role) && !involved.some((storeId) => ownStoreIds.includes(storeId))) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-8 print:px-0 print:py-0">
      <div className="flex items-baseline justify-between border-b border-zinc-300 pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Följesedel</h1>
        <p className="text-sm text-zinc-500">{DATE.format(transfer.createdAt)}</p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Från</dt>
          <dd className="text-lg font-medium">{transfer.acceptingStore?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Till</dt>
          <dd className="text-lg font-medium">{transfer.requestingStore.name}</dd>
        </div>
      </dl>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-300 text-left">
            <th className="py-2 font-semibold">Produkt</th>
            <th className="py-2 font-semibold">Styrka</th>
            <th className="py-2 font-semibold">Format</th>
            <th className="py-2 text-right font-semibold">Antal</th>
          </tr>
        </thead>
        <tbody>
          {transfer.lines.map((line) => (
            <tr key={line.id} className="border-b border-zinc-200">
              <td className="py-2">
                {line.brand} {line.flavor}
              </td>
              <td className="py-2">{line.strength || "—"}</td>
              <td className="py-2">{line.format}</td>
              <td className="py-2 text-right tabular-nums">
                {line.quantity} {TRANSFER_UNIT_LABELS[line.unit]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {transfer.note ? <p className="mt-4 text-sm">{transfer.note}</p> : null}

      <div className="mt-12 grid grid-cols-2 gap-8">
        {["Packad av", "Mottagen av"].map((label) => (
          <div key={label}>
            <div className="h-10 border-b border-zinc-400" />
            <p className="mt-1 text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-zinc-400 print:hidden">
        Skriv ut med webbläsarens utskriftsfunktion.
      </p>
    </main>
  );
}
