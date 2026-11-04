import Link from "next/link";
import { setRequestStatusAction } from "@/lib/request-actions";
import {
  REQUEST_KINDS,
  REQUEST_KIND_LABELS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  toRequestKind,
} from "@/lib/customer-requests";
import { formatDateTime } from "@/lib/format";
import { listRanked } from "@/lib/repositories/customer-requests";
import { listStores } from "@/lib/repositories/stores";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Admin only — staff never see this ranking, just their own confirmation. */
export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; store?: string; kind?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const days = params.days === "90" ? 90 : 30;
  const storeId = params.store || undefined;
  const kind = params.kind ? toRequestKind(params.kind) : undefined;

  const [rows, stores] = await Promise.all([
    listRanked({ days, storeId, kind }),
    listStores(),
  ]);

  const query = new URLSearchParams({
    days: String(days),
    ...(storeId ? { store: storeId } : {}),
    ...(kind ? { kind } : {}),
  }).toString();

  const chip = (active: boolean) =>
    `min-h-tap shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-[2.75rem] ${
      active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Kundönskemål</h1>
      <p className="mt-1 text-zinc-600">
        {rows.length} rader, rankade på antal. Senaste {days} dagarna.
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        Efterfrågan, inte lagersaldo. Inga personuppgifter om kunder lagras.
      </p>

      <div className="mt-4 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[30, 90].map((candidate) => (
            <Link
              key={candidate}
              href={`/admin/requests?days=${candidate}${storeId ? `&store=${storeId}` : ""}${kind ? `&kind=${kind}` : ""}`}
              className={chip(days === candidate)}
            >
              {candidate} dagar
            </Link>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href={`/admin/requests?days=${days}${kind ? `&kind=${kind}` : ""}`} className={chip(!storeId)}>
            Alla butiker
          </Link>
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/admin/requests?days=${days}&store=${store.id}${kind ? `&kind=${kind}` : ""}`}
              className={chip(storeId === store.id)}
            >
              {store.name}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href={`/admin/requests?days=${days}${storeId ? `&store=${storeId}` : ""}`} className={chip(!kind)}>
            Alla typer
          </Link>
          {REQUEST_KINDS.map((candidate) => (
            <Link
              key={candidate}
              href={`/admin/requests?days=${days}${storeId ? `&store=${storeId}` : ""}&kind=${candidate}`}
              className={chip(kind === candidate)}
            >
              {REQUEST_KIND_LABELS[candidate]}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-4">
        <a
          href={`/api/admin/requests/export?${query}`}
          className="inline-flex h-11 items-center rounded-xl border border-zinc-200 px-5 text-sm font-medium transition hover:bg-zinc-50"
        >
          Exportera till Excel
        </a>
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga önskemål i perioden.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-semibold tracking-tight">
                  {[row.brandText, row.flavorText].filter(Boolean).join(" ") || row.productLabel || "—"}
                </p>
                <p className="text-sm tabular-nums text-zinc-500">
                  <span className="text-lg font-semibold text-zinc-900">{row.count}</span> gånger
                </p>
              </div>
              <p className="mt-0.5 text-sm text-zinc-500">
                {row.storeName} · {REQUEST_KIND_LABELS[row.kind]} · senast{" "}
                {formatDateTime(row.lastSeenAt)}
              </p>
              {row.productLabel && (row.brandText || row.flavorText) ? (
                <p className="mt-1 text-sm text-zinc-500">Kopplad produkt: {row.productLabel}</p>
              ) : null}

              <form action={setRequestStatusAction} className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                <input type="hidden" name="id" value={row.id} />
                <select
                  name="status"
                  defaultValue={row.status}
                  aria-label={`Status för ${row.brandText ?? row.id}`}
                  className="min-h-tap rounded-xl border border-zinc-200 px-2 text-sm"
                >
                  {REQUEST_STATUSES.map((status) => (
                    <option key={status} value={status}>{REQUEST_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <input
                  name="statusNote"
                  defaultValue={row.statusNote ?? ""}
                  placeholder="Notering (valfri)"
                  aria-label="Notering"
                  className="min-h-tap rounded-xl border border-zinc-200 px-3 text-sm"
                />
                <button type="submit" className="min-h-tap rounded-xl border border-zinc-200 px-4 text-sm font-medium transition hover:bg-zinc-50">
                  Spara
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
