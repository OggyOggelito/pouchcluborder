import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ui/ConfirmButton";
import PageHeader from "@/components/ui/PageHeader";
import {
  deleteExceptionAction,
  saveExceptionAction,
  saveWeekdayAction,
} from "@/lib/opening-hours-actions";
import { prisma } from "@/lib/db";
import { listExceptions, listOpeningHours } from "@/lib/repositories/opening-hours";
import { stockholmDateKey } from "@/lib/checklists";
import { WEEKDAY_LONG, formatDateString } from "@/lib/schedule/time";
import { canActOnStore, canEditOpeningHours } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Opening hours, and the days that do not follow them.
 *
 * One of two pages under /admin that is not ADMIN-only: an OWNER edits their
 * own store's hours here. So this cannot use `requireAdmin`, and the per-store
 * check below is the whole protection — a store id in the URL is a request.
 *
 * Swedish public holidays are not built in. Five shops in four towns do not
 * have one closing rule, and a wrong built-in calendar would be worse than an
 * empty one: it would be trusted.
 */
export default async function StoreHoursPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sparat?: string; borttagen?: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/admin/stores/${id}/hours`);

  if (!canEditOpeningHours(user.role)) notFound();
  if (!canActOnStore(user.role, user.stores.map((store) => store.id), id)) notFound();

  const flags = await searchParams;

  const [store, hours, exceptions] = await Promise.all([
    prisma.store.findUnique({ where: { id }, select: { id: true, name: true } }),
    listOpeningHours(id),
    listExceptions(id, { from: stockholmDateKey(), to: "2099-12-31" }),
  ]);
  if (!store) notFound();

  const byWeekday = new Map(hours.map((row) => [row.weekday, row]));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title="Öppettider"
        description={`${store.name}. Schemats mallar och luckor räknas fram från de här tiderna.`}
        breadcrumb={{ href: `/store/schedule?store=${store.id}`, label: "Teamschema" }}
      />

      {flags.sparat ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden>✓ </span>Sparat.
        </p>
      ) : null}
      {flags.borttagen ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden>✓ </span>Avvikelsen är borttagen.
        </p>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Vanlig vecka</h2>
        <ul className="mt-3 space-y-2">
          {WEEKDAYS.map((weekday) => {
            const row = byWeekday.get(weekday);
            return (
              <li key={weekday} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <form action={saveWeekdayAction}>
                  <input type="hidden" name="storeId" value={store.id} />
                  <input type="hidden" name="weekday" value={weekday} />

                  <div className="flex flex-wrap items-end gap-3">
                    <span className="min-w-28 font-medium capitalize">
                      {WEEKDAY_LONG[weekday]}
                    </span>

                    <label className="text-sm">
                      <span className="block text-muted">Öppnar</span>
                      <input
                        type="time"
                        name="opensAt"
                        defaultValue={row?.opensAt ?? "10:00"}
                        required
                        className="mt-1 min-h-tap w-28 rounded-xl border border-control bg-raised px-3 tabular-nums"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-muted">Stänger</span>
                      <input
                        type="time"
                        name="closesAt"
                        defaultValue={row?.closesAt ?? "18:00"}
                        required
                        className="mt-1 min-h-tap w-28 rounded-xl border border-control bg-raised px-3 tabular-nums"
                      />
                    </label>

                    <label className="flex min-h-tap items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="closed"
                        defaultChecked={row?.closed ?? false}
                        className="size-5"
                      />
                      Stängt
                    </label>

                    <button
                      type="submit"
                      className="min-h-tap rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                    >
                      Spara
                    </button>
                  </div>

                  {!row ? (
                    <p className="mt-2 text-xs text-warning">
                      <span className="sr-only">Varning:</span>
                      <span aria-hidden>⚠ </span>Inte inlagd ännu — schemat visar &quot;öppettider
                      saknas&quot; för den här dagen.
                    </p>
                  ) : null}
                </form>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Tiderna sparas även när dagen är stängd, så en söndag som öppnar igen inte behöver
          skrivas in på nytt.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Röda dagar och avvikelser</h2>
        <p className="mt-1 text-sm text-muted">
          Svenska helgdagar läggs inte in automatiskt — butikerna stänger olika. Lägg in de dagar
          som gäller er.
        </p>

        {exceptions.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {exceptions.map((exception) => (
              <li
                key={exception.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm"
              >
                <span className="min-w-0">
                  <span className="block font-medium capitalize">
                    {formatDateString(exception.date)}
                  </span>
                  <span className="block text-sm text-muted">
                    {exception.closed
                      ? "Stängt"
                      : `${exception.opensAt}–${exception.closesAt}`}
                    {exception.note ? ` · ${exception.note}` : ""}
                  </span>
                </span>
                <form action={deleteExceptionAction}>
                  <input type="hidden" name="storeId" value={store.id} />
                  <input type="hidden" name="id" value={exception.id} />
                  <ConfirmButton
                    className="min-h-tap rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                    title="Ta bort avvikelsen?"
                    body="Dagen följer då den vanliga veckan igen."
                    confirmLabel="Ta bort"
                    tone="neutral"
                  >
                    Ta bort
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-control p-5 text-center text-sm text-muted">
            Inga avvikelser inlagda framåt i tiden.
          </p>
        )}

        <form action={saveExceptionAction} className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <input type="hidden" name="storeId" value={store.id} />
          <h3 className="font-semibold tracking-tight">Lägg in en dag</h3>

          <label className="mt-3 block text-sm">
            <span className="block font-medium">Datum</span>
            <input
              type="date"
              name="date"
              required
              className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
            />
          </label>

          <label className="mt-3 flex min-h-tap items-center gap-2 text-sm">
            <input type="checkbox" name="closed" className="size-5" />
            <span className="font-medium">Stängt hela dagen</span>
          </label>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block font-medium">Öppnar</span>
              <input
                type="time"
                name="opensAt"
                defaultValue="10:00"
                className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
              />
            </label>
            <label className="block text-sm">
              <span className="block font-medium">Stänger</span>
              <input
                type="time"
                name="closesAt"
                defaultValue="15:00"
                className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-muted">
            Tiderna används bara när dagen inte är markerad som stängd.
          </p>

          <label className="mt-3 block text-sm">
            <span className="block font-medium">Anledning (frivilligt)</span>
            <input
              name="note"
              maxLength={80}
              placeholder="T.ex. julafton, inventering"
              className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
            />
            <span className="mt-1 block text-xs text-muted">
              Beskriver butiken, inte en person.
            </span>
          </label>

          <button
            type="submit"
            className="mt-4 min-h-tap w-full rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99]"
          >
            Spara dagen
          </button>
        </form>
      </section>

      <p className="mt-6 text-sm">
        <Link href={`/store/schedule?store=${store.id}`} className="underline underline-offset-4">
          Tillbaka till teamschemat
        </Link>
      </p>
    </main>
  );
}
