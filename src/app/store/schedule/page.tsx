import Link from "next/link";
import { notFound } from "next/navigation";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { stockholmDateKey } from "@/lib/checklists";
import { formatDateTime } from "@/lib/format";
import { changeLabel } from "@/lib/schedule/grid";
import { addDaysToDate, isDateString } from "@/lib/schedule/time";
import { getScheduleProvider, scheduleIsStoreEntered } from "@/lib/schedule";
import { getWeek } from "@/lib/repositories/schedule-week";
import { countEmployees } from "@/lib/repositories/employees";
import { canActOnStore, canEditSchedule, canViewTeamSchedule } from "@/lib/roles";
import { requireUser, storesForUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Teamschema — Pouch Club" };

/**
 * The week grid: where the schedule is entered.
 *
 * The store and the week both come from the query string and are both checked
 * against the account before anything is read. A store id nobody granted this
 * user is not a 403 page with the store's name on it — it simply resolves to
 * one they do have.
 */
export default async function StoreSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    store?: string;
    date?: string;
    kopierade?: string;
    hoppade?: string;
  }>;
}) {
  const user = await requireUser("/store/schedule");

  // OWNER and ADMIN. STAFF read their own store's week at /schedule instead.
  if (!canViewTeamSchedule(user.role)) notFound();

  const params = await searchParams;
  const stores = await storesForUser(user);
  if (stores.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
        <PageHeader title="Teamschema" />
        <EmptyState
          title="Ingen butik kopplad till ditt konto"
          description="En administratör kopplar butiker under Admin · Konton."
        />
      </main>
    );
  }

  const allowed = stores.find((store) => store.id === params.store);
  const store = allowed ?? stores[0];
  const todayKey = stockholmDateKey();
  const date = isDateString(params.date) ? params.date : todayKey;

  const [week, employeeCounts] = await Promise.all([
    getWeek({ storeId: store.id, date }),
    countEmployees([store.id]),
  ]);
  if (!week) notFound();

  const canEdit =
    canEditSchedule(user.role) &&
    canActOnStore(user.role, user.stores.map((own) => own.id), store.id);

  const monday = week.monday;
  const previousWeek = addDaysToDate(monday, -7);
  const nextWeek = addDaysToDate(monday, 7);
  const href = (nextDate: string) => `/store/schedule?store=${store.id}&date=${nextDate}`;

  const copied = Number(params.kopierade ?? "");
  const skipped = Number(params.hoppade ?? "");

  let providerName: string;
  try {
    providerName = getScheduleProvider().name;
  } catch {
    providerName = "okänd";
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6">
      <PageHeader
        title="Teamschema"
        description={
          <>
            {store.name} · vecka {week.weekNumber}. Schemat skrivs in här av butiken och gäller
            direkt — det finns inget publiceringssteg.
          </>
        }
        action={
          canEdit ? (
            <Link
              href={`/store/schedule/copy?store=${store.id}&target=${monday}&scope=week`}
              className="inline-flex min-h-tap items-center rounded-2xl bg-primary px-5 font-semibold text-on-primary transition active:scale-[0.99]"
            >
              Kopiera förra veckan
            </Link>
          ) : null
        }
      />

      {stores.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {stores.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/store/schedule?store=${candidate.id}&date=${date}`}
              aria-current={candidate.id === store.id ? "true" : undefined}
              className={`min-h-tap rounded-full border px-4 text-sm leading-[2.75rem] transition ${
                candidate.id === store.id
                  ? "border-primary bg-raised font-semibold ring-1 ring-primary"
                  : "border-control bg-surface font-medium text-muted hover:border-control"
              }`}
            >
              {candidate.name}
            </Link>
          ))}
        </div>
      ) : null}

      <nav aria-label="Byt vecka" className="flex items-center justify-between gap-2">
        <Link
          href={href(previousWeek)}
          className="inline-flex min-h-tap items-center rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
        >
          <span aria-hidden>‹</span> Förra veckan
        </Link>
        <Link
          href={href(todayKey)}
          className="inline-flex min-h-tap items-center px-2 text-sm underline underline-offset-4"
        >
          Denna vecka
        </Link>
        <Link
          href={href(nextWeek)}
          className="inline-flex min-h-tap items-center rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
        >
          Nästa vecka <span aria-hidden>›</span>
        </Link>
      </nav>

      {/* The grid always reads the portal's own table. If someone switches the
          provider, say so here rather than letting a manager type a week that
          "Mitt schema" then does not show. */}
      {!scheduleIsStoreEntered() ? (
        <p
          role="alert"
          className="mt-3 rounded-2xl border border-warning bg-raised p-4 text-sm text-warning"
        >
          <span className="sr-only">Varning:</span>
          <span aria-hidden>⚠ </span>
          Aktiv schemakälla är <strong>{providerName}</strong>. Pass du lägger in här sparas, men
          visas inte under Mitt schema förrän{" "}
          <code className="font-mono">SCHEDULE_PROVIDER</code> står på{" "}
          <code className="font-mono">manual</code>.
        </p>
      ) : null}

      {Number.isFinite(copied) && params.kopierade ? (
        <p
          role="status"
          className="mt-3 rounded-2xl border border-success bg-raised p-3 text-sm text-success"
        >
          <span aria-hidden>✓ </span>
          {copied === 1 ? "1 pass kopierat" : `${copied} pass kopierade`}
          {skipped > 0
            ? `. ${skipped === 1 ? "1 rad hoppades över" : `${skipped} rader hoppades över`} — inget skrevs över.`
            : "."}
        </p>
      ) : null}

      {employeeCounts.active === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="Inget schema inlagt ännu"
            description="Lägg först in butikens medarbetare, sedan passen. Ingenting importeras — det är butiken som skriver in schemat."
            action={
              <Link
                href="/store/employees"
                className="inline-flex min-h-tap items-center rounded-2xl bg-primary px-5 font-semibold text-on-primary"
              >
                Lägg in medarbetare
              </Link>
            }
          />
        </div>
      ) : (
        <ScheduleGrid week={week} canEdit={canEdit} todayKey={todayKey} />
      )}

      {canEdit ? (
        <p className="mt-4 text-sm text-muted">
          Tiderna byggs på butikens öppettider.{" "}
          <Link
            href={`/admin/stores/${store.id}/hours`}
            className="underline underline-offset-4"
          >
            Ändra öppettider och röda dagar
          </Link>
          . Marginal före öppning och efter stängning: {week.buffer} min.
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card href="/schedule/available">
          <span className="block font-semibold tracking-tight">Lediga hos andra butiker</span>
          <span className="mt-1 block text-sm text-muted">
            Se vem som är ledig och fråga om ett extrapass.
          </span>
        </Card>
        <Card href="/schedule/extra">
          <span className="block font-semibold tracking-tight">Extrapass</span>
          <span className="mt-1 block text-sm text-muted">
            Förfrågningar in och ut, och vad som blev av dem.
          </span>
        </Card>
        <Card href="/store/employees">
          <span className="block font-semibold tracking-tight">Anställda</span>
          <span className="mt-1 block text-sm text-muted">
            {employeeCounts.active === 1 ? "1 aktiv" : `${employeeCounts.active} aktiva`}
            {employeeCounts.openToExtra > 0
              ? `, ${employeeCounts.openToExtra} ${
                  employeeCounts.openToExtra === 1 ? "öppen" : "öppna"
                } för extrapass`
              : ""}
            .
          </span>
        </Card>
      </div>

      {week.changes.length > 0 ? (
        <details className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <summary className="min-h-tap cursor-pointer font-medium">
            Ändringar i vecka {week.weekNumber} ({week.changes.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {week.changes.map((change) => (
              <li key={change.id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                <span className="block">
                  {changeLabel(change.type)}
                  {change.detail ? ` — ${change.detail}` : ""}
                </span>
                <span className="block text-xs text-muted">
                  {formatDateTime(change.at)}
                  {change.byName ? ` · ${change.byName}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Sparas i 90 dagar, så ett misstag kan spåras. Inget annat om personerna sparas här.
          </p>
        </details>
      ) : null}
    </main>
  );
}
