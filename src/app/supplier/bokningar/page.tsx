import ConfirmButton from "@/components/ui/ConfirmButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { stockholmDateKey } from "@/lib/checklists";
import { cancelDemoDayAction } from "@/lib/demo-day-actions";
import {
  CANCEL_CUTOFF_DAYS,
  DEMO_STATUS_LABELS,
  canSupplierCancel,
  type DemoStatus,
} from "@/lib/demo-days";
import { formatLongDateString, formatRange } from "@/lib/schedule/time";
import { listBookingsForBrand } from "@/lib/repositories/demo-days";
import { markBookingsSeen } from "@/lib/repositories/supplier-users";
import { requireSupplier } from "@/lib/supplier-session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mina bokningar — Pouch Club" };

const TONES: Record<DemoStatus, "info" | "success" | "danger" | "neutral"> = {
  REQUESTED: "info",
  CONFIRMED: "success",
  DECLINED: "danger",
  CANCELLED_BY_SUPPLIER: "neutral",
  CANCELLED_BY_STORE: "neutral",
};

/**
 * The supplier's own bookings, and nothing else's.
 *
 * Scoped by the brand on the session. Opening the page marks the decisions as
 * seen, which is what clears the "nytt svar" marker — this app has no mail
 * transport, so the portal is where a decision is delivered.
 */
export default async function SupplierBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ grupp?: string; avbokad?: string; forsent?: string }>;
}) {
  const supplier = await requireSupplier("/supplier/bokningar");
  const flags = await searchParams;

  const today = stockholmDateKey();
  const bookings = await listBookingsForBrand({ brandId: supplier.brand.id });
  await markBookingsSeen(supplier.id);

  const upcoming = bookings.filter((booking) => booking.date >= today);
  const past = bookings.filter((booking) => booking.date < today);

  return (
    <main className="px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mina bokningar</h1>
      <p className="mt-1 text-muted">{supplier.brand.name}</p>

      {flags.grupp ? (
        <p role="status" className="mt-4 rounded-xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden="true">✓ </span>Förfrågan är skickad. Butikerna svarar var för sig.
        </p>
      ) : null}
      {flags.avbokad ? (
        <p role="status" className="mt-4 rounded-xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden="true">✓ </span>Bokningen är avbokad.
        </p>
      ) : null}
      {flags.forsent ? (
        <p role="alert" className="mt-4 rounded-xl border border-warning bg-raised p-3 text-sm text-warning">
          <span className="sr-only">Varning:</span>
          <span aria-hidden="true">⚠ </span>
          Det är mindre än {CANCEL_CUTOFF_DAYS} dagar kvar, så bokningen går inte att avboka här.
          Ring butiken.
        </p>
      ) : null}

      {upcoming.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-control p-6 text-center text-muted">
          Inga kommande demodagar.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {upcoming.map((booking) => {
            const mayCancel = canSupplierCancel({
              status: booking.status,
              date: booking.date,
              today,
            });
            return (
              <li
                key={booking.id}
                className="rounded-2xl border border-line bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{booking.store.name}</span>
                    <span className="block text-sm capitalize text-muted">
                      {formatLongDateString(booking.date)}
                    </span>
                    <span className="block text-sm tabular-nums text-muted">
                      {formatRange(booking.startsAt, booking.endsAt)}
                    </span>
                  </span>
                  <StatusBadge tone={TONES[booking.status]}>
                    {DEMO_STATUS_LABELS[booking.status]}
                  </StatusBadge>
                </div>

                {booking.decisionNote ? (
                  <p className="mt-3 rounded-xl bg-raised p-3 text-sm">
                    <span className="block text-xs text-muted">Från butiken</span>
                    {booking.decisionNote}
                  </p>
                ) : null}

                {mayCancel ? (
                  <form action={cancelDemoDayAction} className="mt-3">
                    <input type="hidden" name="id" value={booking.id} />
                    <ConfirmButton
                      className="min-h-tap w-full rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                      title="Avboka demodagen?"
                      body={`${booking.store.name} får veta att ni inte kommer.`}
                      confirmLabel="Avboka"
                      tone="neutral"
                    >
                      Avboka
                    </ConfirmButton>
                  </form>
                ) : booking.status === "REQUESTED" || booking.status === "CONFIRMED" ? (
                  <p className="mt-3 text-xs text-muted">
                    Mindre än {CANCEL_CUTOFF_DAYS} dagar kvar — ring butiken om något ändras.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 ? (
        <details className="mt-8 rounded-2xl border border-line bg-surface p-4">
          <summary className="min-h-tap cursor-pointer font-medium">
            Tidigare ({past.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {past.slice(0, 50).map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 border-t border-line pt-2 first:border-t-0 first:pt-0">
                <span>
                  {booking.store.name} · <span className="capitalize">{formatLongDateString(booking.date)}</span>
                </span>
                <span className="shrink-0 text-muted">{DEMO_STATUS_LABELS[booking.status]}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </main>
  );
}
