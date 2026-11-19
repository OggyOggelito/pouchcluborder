import Link from "next/link";
import { notFound } from "next/navigation";
import ExtraShiftRequest from "@/components/schedule/ExtraShiftRequest";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { stockholmDateKey } from "@/lib/checklists";
import { getAvailability } from "@/lib/repositories/availability";
import { effectiveHoursForRange } from "@/lib/repositories/opening-hours";
import { isOpen, shiftTemplates } from "@/lib/schedule/opening-hours";
import {
  WEEKDAY_SHORT,
  addDaysToDate,
  formatLongDateString,
  isDateString,
  isTimeString,
  weekdayOf,
} from "@/lib/schedule/time";
import { bufferMinutes } from "@/lib/repositories/schedule-week";
import { canAccessAllStores, canViewAvailability } from "@/lib/roles";
import { requireUser, storesForUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lediga hos andra butiker — Pouch Club" };

/** How far ahead the day chips reach. */
const DAYS = 14;

/**
 * "Lediga hos andra butiker".
 *
 * The thinnest view in the app on purpose: a name, a home store, and "ledig".
 * No hours, no "jobbar i Täby istället", no contact details. A manager who
 * wants somebody asks their store, and that store answers — which is what the
 * button does.
 */
export default async function AvailablePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; date?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser("/schedule/available");

  // OWNER and ADMIN. STAFF never see another store's employees.
  if (!canViewAvailability(user.role)) notFound();

  const params = await searchParams;
  const stores = await storesForUser(user);
  const store = stores.find((candidate) => candidate.id === params.store) ?? stores[0];

  if (!store) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
        <PageHeader title="Lediga hos andra butiker" />
        <EmptyState
          title="Ingen butik kopplad till ditt konto"
          description="En administratör kopplar butiker under Admin · Konton."
        />
      </main>
    );
  }

  const todayKey = stockholmDateKey();
  const date = isDateString(params.date) ? params.date : todayKey;
  const from = isTimeString(params.from) ? params.from : null;
  const to = isTimeString(params.to) ? params.to : null;
  const window = from && to ? { startsAt: from, endsAt: to } : null;

  const [result, hours] = await Promise.all([
    getAvailability({
      requestingStoreId: store.id,
      date,
      startsAt: window?.startsAt ?? null,
      endsAt: window?.endsAt ?? null,
      seesAllStores: canAccessAllStores(user.role),
    }),
    effectiveHoursForRange(store.id, [date]),
  ]);

  // The asking store's own hours decide the suggested times: a borrowed shift
  // is a shift in *our* shop.
  const dayHours = hours[0];
  const templates = dayHours ? shiftTemplates(dayHours, bufferMinutes()) : [];
  const defaultStartsAt = window?.startsAt ?? templates[0]?.startsAt ?? "10:00";
  const defaultEndsAt = window?.endsAt ?? templates[0]?.endsAt ?? "18:00";

  const days = Array.from({ length: DAYS }, (_, offset) => addDaysToDate(todayKey, offset));
  const dayHref = (value: string) =>
    `/schedule/available?store=${store.id}&date=${value}${window ? `&from=${window.startsAt}&to=${window.endsAt}` : ""}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title="Lediga hos andra butiker"
        description="Vem som kan ta ett extrapass hos er. Vi visar bara namn, hembutik och att personen är ledig."
      />

      {stores.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {stores.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/schedule/available?store=${candidate.id}&date=${date}`}
              aria-current={candidate.id === store.id ? "true" : undefined}
              className={`min-h-tap rounded-full border px-4 text-sm leading-[2.75rem] transition ${
                candidate.id === store.id
                  ? "border-primary bg-raised font-semibold ring-1 ring-primary"
                  : "border-control bg-surface font-medium text-muted"
              }`}
            >
              {candidate.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Välj dag"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {days.map((value) => {
          const selected = value === date;
          return (
            <Link
              key={value}
              href={dayHref(value)}
              role="tab"
              aria-selected={selected}
              className={`min-h-tap shrink-0 rounded-2xl border px-3 py-2 text-center transition ${
                selected
                  ? "border-primary bg-raised ring-1 ring-primary"
                  : "border-control bg-surface"
              }`}
            >
              <span className="block text-xs capitalize text-muted">
                {WEEKDAY_SHORT[weekdayOf(value)]}
                {value === todayKey ? " · idag" : ""}
              </span>
              <span className="block text-sm font-semibold tabular-nums">
                {value.slice(8)}/{Number(value.slice(5, 7))}
              </span>
            </Link>
          );
        })}
      </div>

      <form method="get" className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <input type="hidden" name="store" value={store.id} />
        <input type="hidden" name="date" value={date} />
        <p className="text-sm font-medium">Begränsa till tider (frivilligt)</p>
        <p className="mt-0.5 text-sm text-muted">
          Utan tider betyder ledig att personen inte har något pass alls den dagen.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block font-medium">Från</span>
            <input
              type="time"
              name="from"
              defaultValue={from ?? ""}
              className="mt-1 min-h-tap w-32 rounded-xl border border-control bg-raised px-3 tabular-nums"
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium">Till</span>
            <input
              type="time"
              name="to"
              defaultValue={to ?? ""}
              className="mt-1 min-h-tap w-32 rounded-xl border border-control bg-raised px-3 tabular-nums"
            />
          </label>
          <button
            type="submit"
            className="min-h-tap rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
          >
            Visa
          </button>
          {window ? (
            <Link
              href={`/schedule/available?store=${store.id}&date=${date}`}
              className="inline-flex min-h-tap items-center text-sm underline underline-offset-4"
            >
              Rensa tider
            </Link>
          ) : null}
        </div>
      </form>

      <p className="mt-4 text-sm capitalize">{formatLongDateString(date)}</p>
      {dayHours && !isOpen(dayHours) ? (
        <p className="mt-1 text-sm text-warning">
          <span className="sr-only">Varning:</span>
          <span aria-hidden>⚠ </span>
          {dayHours.source === "missing"
            ? "Butikens öppettider är inte inlagda för den dagen."
            : "Er butik är stängd den dagen."}
        </p>
      ) : null}

      {result.searchedStores.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Inga närliggande butiker"
            description={
              result.fromRegion
                ? "Butiken har ingen region satt, eller är ensam i sin region. En administratör kan koppla butiker till varandra."
                : "En administratör har inte kopplat den här butiken till någon annan."
            }
            action={
              canAccessAllStores(user.role) ? (
                <Link
                  href="/admin/nearby"
                  className="inline-flex min-h-tap items-center underline underline-offset-4"
                >
                  Hantera närliggande butiker
                </Link>
              ) : null
            }
          />
        </div>
      ) : result.rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Ingen är ledig den dagen"
            description={`Vi sökte hos ${result.searchedStores.map((candidate) => candidate.name).join(", ")}. Bara medarbetare som själva har sagt ja till extrapass visas här.`}
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {result.rows.map((row) => (
            <li key={row.employeeId}>
              <ExtraShiftRequest
                requestingStoreId={store.id}
                employeeId={row.employeeId}
                employeeName={row.name}
                homeStoreName={row.homeStoreName}
                date={date}
                defaultStartsAt={defaultStartsAt}
                defaultEndsAt={defaultEndsAt}
                alreadyAsked={row.alreadyAsked}
              />
            </li>
          ))}
        </ul>
      )}

      {result.searchedStores.length > 0 ? (
        <p className="mt-5 text-xs text-muted">
          Sökte hos {result.searchedStores.map((candidate) => candidate.name).join(", ")}.{" "}
          {result.fromRegion
            ? "Butiker räknas som närliggande om de har samma region."
            : "Närliggande butiker är inlagda av en administratör."}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-muted">
        <Link href="/schedule/extra" className="underline underline-offset-4">
          Se skickade och inkomna extrapass
        </Link>
      </p>
    </main>
  );
}
