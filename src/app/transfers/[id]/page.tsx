import Link from "next/link";
import { notFound } from "next/navigation";
import { acceptTransferAction, moveTransferAction } from "@/lib/transfer-actions";
import { formatDateTime } from "@/lib/format";
import {
  NO_RESERVATION_NOTICE,
  TRANSFER_STATUS_LABELS,
  TRANSFER_UNIT_LABELS,
} from "@/lib/transfers";
import { accepterIdsFor, getTransfer } from "@/lib/repositories/transfers";
import { canAccessAdmin, canPlaceOrders } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TransferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ taken?: string; stale?: string }>;
}) {
  const user = await requireUser("/transfers");
  const { id } = await params;
  const { taken, stale } = await searchParams;

  const transfer = await getTransfer(id);
  if (!transfer) notFound();

  const ownStoreIds = user.stores.map((store) => store.id);
  const isAdmin = canAccessAdmin(user.role);

  // Visible to the stores involved, plus anyone in the region who could still
  // answer an open request. Checked here, not just hidden in the list query.
  const eligible = await accepterIdsFor(transfer.id);
  const involved = [
    transfer.requestingStore.id,
    transfer.targetStore?.id,
    transfer.acceptingStore?.id,
  ].filter(Boolean) as string[];

  const mayView =
    isAdmin ||
    involved.some((storeId) => ownStoreIds.includes(storeId)) ||
    eligible.some((storeId) => ownStoreIds.includes(storeId));
  if (!mayView) notFound();

  const mayManage = canPlaceOrders(user.role);
  const myAcceptingStore = eligible.find((storeId) => ownStoreIds.includes(storeId));
  const isRequester = ownStoreIds.includes(transfer.requestingStore.id) || isAdmin;
  const isSender = transfer.acceptingStore
    ? ownStoreIds.includes(transfer.acceptingStore.id) || isAdmin
    : false;

  const button =
    "h-12 w-full rounded-2xl px-6 font-semibold transition active:scale-[0.99]";

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <Link href="/transfers" className="inline-flex h-9 items-center text-sm text-zinc-500 underline underline-offset-4">
        ← Alla överföringar
      </Link>

      {taken ? (
        <p role="alert" className="mt-4 rounded-2xl bg-amber-50 p-4 font-medium text-amber-900">
          Redan tagen av {taken}.
        </p>
      ) : null}
      {stale ? (
        <p role="alert" className="mt-4 rounded-2xl bg-amber-50 p-4 text-amber-900">
          Överföringen hann ändras — läs om sidan och försök igen.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {transfer.requestingStore.name}
          <span className="font-normal text-zinc-400"> söker från </span>
          {transfer.targetStore?.name ?? transfer.acceptingStore?.name ?? "regionen"}
        </h1>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium">
          {TRANSFER_STATUS_LABELS[transfer.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Skapad {formatDateTime(transfer.createdAt)}
        {transfer.createdByName ? ` av ${transfer.createdByName}` : ""}
      </p>

      <ul className="mt-5 space-y-2">
        {transfer.lines.map((line) => (
          <li key={line.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="font-medium">
              {line.brand} {line.flavor}
            </p>
            <p className="text-sm text-zinc-500">
              {line.strength} · {line.format}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {line.quantity} {TRANSFER_UNIT_LABELS[line.unit]}
            </p>
          </li>
        ))}
      </ul>

      {transfer.note ? (
        <p className="mt-4 rounded-2xl bg-zinc-100 p-4 text-sm">{transfer.note}</p>
      ) : null}

      <p className="mt-4 text-sm text-zinc-500">{NO_RESERVATION_NOTICE}</p>

      {mayManage ? (
        <div className="mt-6 space-y-2">
          {transfer.status === "REQUESTED" && myAcceptingStore ? (
            <>
              <form action={acceptTransferAction}>
                <input type="hidden" name="transferId" value={transfer.id} />
                <input type="hidden" name="acceptingStoreId" value={myAcceptingStore} />
                <button type="submit" className={`${button} bg-zinc-900 text-white`}>
                  Vi kan hjälpa till
                </button>
              </form>
              <form action={moveTransferAction}>
                <input type="hidden" name="transferId" value={transfer.id} />
                <input type="hidden" name="to" value="DECLINED" />
                <button type="submit" className={`${button} border border-zinc-200`}>
                  Nej, vi kan inte
                </button>
              </form>
            </>
          ) : null}

          {transfer.status === "ACCEPTED" && isSender ? (
            <form action={moveTransferAction}>
              <input type="hidden" name="transferId" value={transfer.id} />
              <input type="hidden" name="to" value="SENT" />
              <button type="submit" className={`${button} bg-zinc-900 text-white`}>
                Markera som skickad
              </button>
            </form>
          ) : null}

          {transfer.status === "SENT" && isRequester ? (
            <form action={moveTransferAction}>
              <input type="hidden" name="transferId" value={transfer.id} />
              <input type="hidden" name="to" value="RECEIVED" />
              <button type="submit" className={`${button} bg-zinc-900 text-white`}>
                Vi har tagit emot
              </button>
            </form>
          ) : null}

          {["REQUESTED", "ACCEPTED"].includes(transfer.status) && isRequester ? (
            <form action={moveTransferAction}>
              <input type="hidden" name="transferId" value={transfer.id} />
              <input type="hidden" name="to" value="CANCELLED" />
              <button type="submit" className={`${button} border border-zinc-200 text-zinc-600`}>
                Avbryt förfrågan
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {transfer.acceptingStore ? (
        <p className="mt-4">
          <Link
            href={`/transfers/${transfer.id}/print`}
            className="inline-flex h-11 items-center rounded-xl border border-zinc-200 px-5 text-sm font-medium"
          >
            Följesedel
          </Link>
        </p>
      ) : null}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-zinc-500">Historik</h2>
      <ol className="mt-3 space-y-2">
        {transfer.events.map((event) => (
          <li key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span>
              {TRANSFER_STATUS_LABELS[event.type as keyof typeof TRANSFER_STATUS_LABELS] ?? "Skapad"}
              {event.detail ? <span className="text-zinc-500"> · {event.detail}</span> : null}
              {event.userName ? <span className="text-zinc-400"> · {event.userName}</span> : null}
            </span>
            <span className="shrink-0 text-xs text-zinc-400">{formatDateTime(event.at)}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
