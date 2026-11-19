import Link from "next/link";
import DemoDayDecision from "@/components/DemoDayDecision";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { stockholmDateKey } from "@/lib/checklists";
import { DEMO_STATUSES, DEMO_STATUS_LABELS_STAFF, toDemoStatus, type DemoStatus } from "@/lib/demo-days";
import { addDaysToDate, formatDateString, formatRange, isDateString } from "@/lib/schedule/time";
import { listAllBookings } from "@/lib/repositories/demo-days";
import { listStores } from "@/lib/repositories/stores";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Demodagar — Pouch Club" };

const TONES: Record<DemoStatus, "info" | "success" | "danger" | "neutral"> = {
  REQUESTED: "info",
  CONFIRMED: "success",
  DECLINED: "danger",
  CANCELLED_BY_SUPPLIER: "neutral",
  CANCELLED_BY_STORE: "neutral",
};

/** Every store's demo days, filterable, with an export. */
export default async function AdminDemoDaysPage({
  searchParams,
}: {
  searchParams: Promise<{
    fran?: string;
    till?: string;
    butik?: string;
    status?: string;
    sparat?: string;
    krock?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const today = stockholmDateKey();
  const from = isDateString(params.fran) ? params.fran : today;
  const to = isDateString(params.till) ? params.till : addDaysToDate(today, 90);
  const storeId = params.butik || null;
  const status = params.status ? toDemoStatus(params.status) : null;

  const [stores, bookings] = await Promise.all([
    listStores(),
    listAllBookings({ from, to, storeId, status }),
  ]);

  const exportParams = new URLSearchParams({ fran: from, till: to });
  if (storeId) exportParams.set("butik", storeId);
  if (status) exportParams.set("status", status);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <PageHeader
        title="Demodagar"
        description="Alla butiker. Butiken svarar själv, men du kan svara åt dem."
        breadcrumb={{ href: "/admin", label: "Admin" }}
        action={
          <Link
            href={`/admin/demo-days/export?${exportParams.toString()}`}
            prefetch={false}
            className="inline-flex min-h-tap items-center rounded-2xl border border-control px-5 text-sm font-medium transition hover:bg-raised"
          >
            Exportera
          </Link>
        }
      />

      {params.sparat ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden="true">✓ </span>Svaret är skickat.
        </p>
      ) : null}
      {params.krock ? (
        <p role="alert" className="mb-4 rounded-2xl border border-warning bg-raised p-3 text-sm text-warning">
          <span className="sr-only">Varning:</span>
          <span aria-hidden="true">⚠ </span>Butiken har redan en bekräftad demodag den dagen.
        </p>
      ) : null}

      <form method="get" className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block font-medium">Från</span>
            <input
              type="date"
              name="fran"
              defaultValue={from}
              className="mt-1 min-h-tap w-40 rounded-xl border border-control bg-raised px-3 tabular-nums"
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium">Till</span>
            <input
              type="date"
              name="till"
              defaultValue={to}
              className="mt-1 min-h-tap w-40 rounded-xl border border-control bg-raised px-3 tabular-nums"
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium">Butik</span>
            <select
              name="butik"
              defaultValue={storeId ?? ""}
              className="mt-1 min-h-tap rounded-xl border border-control bg-raised px-3"
            >
              <option value="">Alla</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block font-medium">Status</span>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="mt-1 min-h-tap rounded-xl border border-control bg-raised px-3"
            >
              <option value="">Alla</option>
              {DEMO_STATUSES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {DEMO_STATUS_LABELS_STAFF[candidate]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-tap rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
          >
            Visa
          </button>
        </div>
      </form>

      {bookings.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Inga demodagar i urvalet" />
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {bookings.map((booking) => (
            <li key={booking.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {booking.brand.name} · {booking.store.name}
                  </span>
                  <span className="block text-sm capitalize text-muted">
                    {formatDateString(booking.date)} ·{" "}
                    <span className="tabular-nums">
                      {formatRange(booking.startsAt, booking.endsAt)}
                    </span>
                  </span>
                  {booking.note ? (
                    <span className="mt-1 block text-sm">{booking.note}</span>
                  ) : null}
                </span>
                <StatusBadge tone={TONES[booking.status]}>
                  {DEMO_STATUS_LABELS_STAFF[booking.status]}
                </StatusBadge>
              </div>

              {booking.status === "REQUESTED" ? (
                <DemoDayDecision
                  bookingId={booking.id}
                  brandName={booking.brand.name}
                  storeName={booking.store.name}
                  back="/admin/demo-days"
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
