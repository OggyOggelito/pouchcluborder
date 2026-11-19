import ConfirmButton from "@/components/ui/ConfirmButton";
import OrderPauseForm from "@/components/OrderPauseForm";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { liftPauseAction } from "@/lib/order-pause-actions";
import {
  PAUSE_SCOPE_LABELS,
  PAUSE_STILL_WORKS,
  describePause,
  describeScheduled,
  isActive,
  isScheduled,
} from "@/lib/order-pause";
import { listOverrides, listPauseHistory } from "@/lib/repositories/order-pause";
import { listStores } from "@/lib/repositories/stores";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pausa beställningar — Pouch Club" };

/**
 * Pausing ordering.
 *
 * A pause is a window with a message, not a switch, and lifting it keeps the
 * row — so the history below answers "why could nobody order last Tuesday".
 * Overrides are listed under the pause they went round, with the reason the
 * admin had to type.
 */
export default async function OrderPausePage({
  searchParams,
}: {
  searchParams: Promise<{ sparat?: string; lyft?: string }>;
}) {
  await requireAdmin();
  const flags = await searchParams;

  const [stores, brands, history] = await Promise.all([
    listStores(),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listPauseHistory(),
  ]);

  const now = new Date();
  const live = history.filter((pause) => isActive(pause, now));
  const planned = history.filter((pause) => isScheduled(pause, now));
  const overridesByPause = new Map(
    await Promise.all(
      live.map(async (pause) => [pause.id, await listOverrides(pause.id)] as const)
    )
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title="Pausa beställningar"
        description="Stoppar nya beställningar. Utkast, historik och export påverkas inte."
        breadcrumb={{ href: "/admin", label: "Admin" }}
      />

      {flags.sparat ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden="true">✓ </span>Pausen är sparad.
        </p>
      ) : null}
      {flags.lyft ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden="true">✓ </span>Pausen är lyft. Butikerna kan beställa igen.
        </p>
      ) : null}

      {live.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight">Pågår nu</h2>
          <ul className="mt-3 space-y-3">
            {live.map((pause) => {
              const overrides = overridesByPause.get(pause.id) ?? [];
              return (
                <li key={pause.id} className="rounded-2xl border border-warning bg-raised p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-medium text-warning">{describePause(pause)}</span>
                      <span className="mt-1 block text-sm text-muted">
                        {PAUSE_SCOPE_LABELS[pause.scope]}
                        {pause.storeName ? ` · ${pause.storeName}` : ""}
                        {pause.brandName ? ` · ${pause.brandName}` : ""} · startad{" "}
                        {formatDateTime(pause.startsAt)}
                        {pause.byName ? ` av ${pause.byName}` : ""}
                      </span>
                    </span>
                    <StatusBadge tone="warning">Pausad</StatusBadge>
                  </div>

                  <form action={liftPauseAction} className="mt-3">
                    <input type="hidden" name="id" value={pause.id} />
                    <ConfirmButton
                      className="min-h-tap w-full rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-surface"
                      title="Lyfta pausen?"
                      body="Butikerna kan beställa igen direkt."
                      confirmLabel="Lyft pausen"
                      tone="neutral"
                    >
                      Lyft pausen
                    </ConfirmButton>
                  </form>

                  {overrides.length > 0 ? (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="text-sm font-medium">
                        {overrides.length === 1
                          ? "1 beställning har släppts igenom"
                          : `${overrides.length} beställningar har släppts igenom`}
                      </p>
                      <ul className="mt-1 space-y-1 text-xs text-muted">
                        {overrides.map((override) => (
                          <li key={override.id}>
                            {formatDateTime(override.createdAt)}
                            {override.byName ? ` · ${override.byName}` : ""} — {override.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="mb-6 rounded-2xl border border-success bg-raised p-4 text-sm text-success">
          <span aria-hidden="true">✓ </span>Beställningar är öppna.
        </p>
      )}

      {planned.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight">Planerat</h2>
          <ul className="mt-3 space-y-2">
            {planned.map((pause) => (
              <li
                key={pause.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
              >
                <span className="min-w-0 text-sm">{describeScheduled(pause)}</span>
                <form action={liftPauseAction}>
                  <input type="hidden" name="id" value={pause.id} />
                  <button
                    type="submit"
                    className="min-h-tap shrink-0 rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                  >
                    Ta bort
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <OrderPauseForm stores={stores} brands={brands} />

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-semibold tracking-tight">Det här fungerar ändå</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {PAUSE_STILL_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      {history.length > 0 ? (
        <details className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <summary className="min-h-tap cursor-pointer font-medium">
            Historik ({history.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((pause) => (
              <li key={pause.id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                <span className="block">{pause.message}</span>
                <span className="block text-xs text-muted">
                  {PAUSE_SCOPE_LABELS[pause.scope]}
                  {pause.storeName ? ` · ${pause.storeName}` : ""}
                  {pause.brandName ? ` · ${pause.brandName}` : ""} ·{" "}
                  {formatDateTime(pause.startsAt)}
                  {pause.endsAt ? ` – ${formatDateTime(pause.endsAt)}` : ""}
                  {pause.liftedAt
                    ? ` · lyft ${formatDateTime(pause.liftedAt)}${pause.liftedByName ? ` av ${pause.liftedByName}` : ""}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </main>
  );
}
