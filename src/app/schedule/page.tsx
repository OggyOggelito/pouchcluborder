import Link from "next/link";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { stockholmDateKey } from "@/lib/checklists";
import { employeeForUser } from "@/lib/repositories/employees";
import { getWeek, upcomingShiftsForEmployee } from "@/lib/repositories/schedule-week";
import {
  addDaysToDate,
  formatDateString,
  formatHours,
  formatRange,
  isDateString,
  toMinutes,
} from "@/lib/schedule/time";
import { canEditSchedule } from "@/lib/roles";
import { requireUser, storesForUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mitt schema — Pouch Club" };

/** How far ahead "mina pass" looks. */
const DAYS_AHEAD = 28;

/**
 * "Mitt schema" — your own shifts, and your store's week.
 *
 * Two things can be missing here and they mean different things. No employee
 * record means nobody has linked this account to a person, so we cannot know
 * whose shifts to show — an admin fixes that. No shifts means the store has
 * not written the week yet, which is a job for the store, not an error.
 */
export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; date?: string }>;
}) {
  const user = await requireUser("/schedule");
  const params = await searchParams;

  const todayKey = stockholmDateKey();
  const date = isDateString(params.date) ? params.date : todayKey;

  const stores = await storesForUser(user);
  const store = stores.find((candidate) => candidate.id === params.store) ?? stores[0] ?? null;

  const employee = await employeeForUser(user.id);
  const [mine, week] = await Promise.all([
    employee
      ? upcomingShiftsForEmployee({
          employeeId: employee.id,
          from: todayKey,
          to: addDaysToDate(todayKey, DAYS_AHEAD),
        })
      : Promise.resolve([]),
    store ? getWeek({ storeId: store.id, date }) : Promise.resolve(null),
  ]);

  const mayEdit = canEditSchedule(user.role);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
      <PageHeader
        title="Mitt schema"
        description={
          employee
            ? `Dina pass de närmaste ${DAYS_AHEAD} dagarna, och butikens vecka.`
            : "Butikens vecka."
        }
      />

      {!employee ? (
        <Card className="mb-4">
          <p className="font-medium">Ditt konto är inte kopplat till en medarbetare</p>
          <p className="mt-1 text-sm text-muted">
            Därför kan vi inte visa just dina pass. Butiksansvarig kopplar kontot under
            Anställda — tills dess ser du butikens hela vecka nedanför.
          </p>
          {mayEdit ? (
            <Link
              href="/store/employees"
              className="mt-3 inline-flex min-h-tap items-center text-sm font-medium underline underline-offset-4"
            >
              Koppla konton till medarbetare
            </Link>
          ) : null}
        </Card>
      ) : mine.length === 0 ? (
        <div className="mb-5">
          <EmptyState
            title="Inga pass inlagda ännu"
            description={`Du har inga pass de närmaste ${DAYS_AHEAD} dagarna. Schemat skrivs in av butiken.`}
          />
        </div>
      ) : (
        <section className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight">Dina pass</h2>
          <ul className="mt-2 space-y-2">
            {mine.map((shift) => (
              <li
                key={shift.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-4 shadow-sm"
              >
                <span className="min-w-0">
                  <span className="block font-medium capitalize">
                    {formatDateString(shift.date)}
                    {shift.date === todayKey ? (
                      <span className="ml-2 align-middle">
                        <StatusBadge tone="info">Idag</StatusBadge>
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-sm text-muted">
                    {shift.storeName}
                    {shift.isExtra ? " · extrapass" : ""}
                    {shift.note ? ` · ${shift.note}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-medium tabular-nums">
                    {formatRange(shift.startsAt, shift.endsAt)}
                  </span>
                  <span className="block text-xs text-muted">
                    {formatHours(toMinutes(shift.endsAt) - toMinutes(shift.startsAt))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {store && week ? (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {store.name}, vecka {week.weekNumber}
            </h2>
            {mayEdit ? (
              <Link
                href={`/store/schedule?store=${store.id}&date=${date}`}
                className="inline-flex min-h-tap items-center text-sm font-medium underline underline-offset-4"
              >
                Ändra schemat
              </Link>
            ) : null}
          </div>

          {stores.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {stores.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/schedule?store=${candidate.id}&date=${date}`}
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

          <nav aria-label="Byt vecka" className="mt-3 flex items-center justify-between gap-2">
            <Link
              href={`/schedule?store=${store.id}&date=${addDaysToDate(week.monday, -7)}`}
              className="inline-flex min-h-tap items-center rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
            >
              <span aria-hidden>‹</span> Förra veckan
            </Link>
            <Link
              href={`/schedule?store=${store.id}&date=${todayKey}`}
              className="inline-flex min-h-tap items-center px-2 text-sm underline underline-offset-4"
            >
              Denna vecka
            </Link>
            <Link
              href={`/schedule?store=${store.id}&date=${addDaysToDate(week.monday, 7)}`}
              className="inline-flex min-h-tap items-center rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
            >
              Nästa vecka <span aria-hidden>›</span>
            </Link>
          </nav>

          {week.days.every((day) => day.shifts.length === 0) ? (
            <div className="mt-4">
              <EmptyState
                title="Inget schema inlagt ännu"
                description={
                  mayEdit
                    ? "Butikens vecka är tom. Lägg in passen i teamschemat."
                    : "Butikens vecka är tom. Butiksansvarig lägger in passen."
                }
                action={
                  mayEdit ? (
                    <Link
                      href={`/store/schedule?store=${store.id}&date=${date}`}
                      className="inline-flex min-h-tap items-center rounded-2xl bg-primary px-5 font-semibold text-on-primary"
                    >
                      Lägg in schema
                    </Link>
                  ) : null
                }
              />
            </div>
          ) : (
            // Read-only for everyone here, including an owner: this is the
            // "what is happening" view. Editing is one tap away above.
            <ScheduleGrid week={week} canEdit={false} todayKey={todayKey} />
          )}
        </section>
      ) : (
        <EmptyState
          title="Ingen butik kopplad till ditt konto"
          description="En administratör kopplar butiker under Admin · Konton."
        />
      )}
    </main>
  );
}
