import { notFound } from "next/navigation";
import DemoDayDecision from "@/components/DemoDayDecision";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { stockholmDateKey } from "@/lib/checklists";
import {
  DEMO_STATUS_LABELS_STAFF,
  type DemoStatus,
} from "@/lib/demo-days";
import { formatLongDateString, formatRange } from "@/lib/schedule/time";
import { listBookingsForStores } from "@/lib/repositories/demo-days";
import { canActOnStore, canDecideDemoDays } from "@/lib/roles";
import { requireUser, storesForUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Demodagar — Pouch Club" };

const TONES: Record<DemoStatus, "info" | "success" | "danger" | "neutral"> = {
  REQUESTED: "info",
  CONFIRMED: "success",
  DECLINED: "danger",
  CANCELLED_BY_SUPPLIER: "neutral",
  CANCELLED_BY_STORE: "neutral",
};

/**
 * Demo days in this shop.
 *
 * STAFF read it so they know who is coming and when — a supplier turning up
 * unannounced is the thing this feature exists to stop. OWNER and ADMIN also
 * answer the requests.
 */
export default async function StoreDemoDaysPage({
  searchParams,
}: {
  searchParams: Promise<{ sparat?: string; krock?: string; svarat?: string }>;
}) {
  const user = await requireUser("/store/demo-days");
  const flags = await searchParams;

  const stores = await storesForUser(user);
  if (stores.length === 0) notFound();

  const today = stockholmDateKey();
  const bookings = await listBookingsForStores({
    storeIds: stores.map((store) => store.id),
    from: today,
  });

  const mayDecide = canDecideDemoDays(user.role);
  const pending = bookings.filter((booking) => booking.status === "REQUESTED");
  const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title="Demodagar"
        description="Leverantörer som vill stå i butiken. Butiken svarar själv."
      />

      {flags.sparat ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden="true">✓ </span>Svaret är skickat.
        </p>
      ) : null}
      {flags.krock ? (
        <p role="alert" className="mb-4 rounded-2xl border border-warning bg-raised p-3 text-sm text-warning">
          <span className="sr-only">Varning:</span>
          <span aria-hidden="true">⚠ </span>Butiken har redan en bekräftad demodag den dagen.
        </p>
      ) : null}
      {flags.svarat ? (
        <p role="alert" className="mb-4 rounded-2xl border border-warning bg-raised p-3 text-sm text-warning">
          <span className="sr-only">Varning:</span>
          <span aria-hidden="true">⚠ </span>Någon hann svara före dig.
        </p>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          {pending.length === 0
            ? "Inget väntar på svar"
            : pending.length === 1
              ? "1 förfrågan väntar på svar"
              : `${pending.length} förfrågningar väntar på svar`}
        </h2>

        <ul className="mt-3 space-y-3">
          {pending.map((booking) => (
            <li key={booking.id} className="rounded-2xl border border-primary bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium">{booking.brand.name}</span>
                  <span className="block text-sm capitalize text-muted">
                    {formatLongDateString(booking.date)} ·{" "}
                    <span className="tabular-nums">
                      {formatRange(booking.startsAt, booking.endsAt)}
                    </span>
                  </span>
                  {stores.length > 1 ? (
                    <span className="block text-sm text-muted">{booking.store.name}</span>
                  ) : null}
                </span>
                <StatusBadge tone="info">Svara</StatusBadge>
              </div>

              {booking.note ? (
                <p className="mt-3 whitespace-pre-line rounded-xl bg-raised p-3 text-sm">
                  {booking.note}
                </p>
              ) : null}

              {mayDecide &&
              canActOnStore(user.role, user.stores.map((store) => store.id), booking.store.id) ? (
                <DemoDayDecision
                  bookingId={booking.id}
                  brandName={booking.brand.name}
                  storeName={booking.store.name}
                  back="/store/demo-days"
                />
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Butiksansvarig svarar på förfrågan.
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Bekräftade</h2>
        {confirmed.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Inga inbokade demodagar" />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {confirmed.map((booking) => (
              <li
                key={booking.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{booking.brand.name}</span>
                  <span className="block text-sm capitalize text-muted">
                    {formatLongDateString(booking.date)} ·{" "}
                    <span className="tabular-nums">
                      {formatRange(booking.startsAt, booking.endsAt)}
                    </span>
                  </span>
                  {stores.length > 1 ? (
                    <span className="block text-sm text-muted">{booking.store.name}</span>
                  ) : null}
                  {booking.note ? (
                    <span className="mt-1 block text-sm">{booking.note}</span>
                  ) : null}
                </span>
                <StatusBadge tone={TONES[booking.status]}>
                  {DEMO_STATUS_LABELS_STAFF[booking.status]}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
