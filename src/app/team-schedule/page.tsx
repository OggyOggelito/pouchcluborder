import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamSchedule } from "@/lib/schedule/queries";
import { canViewTeamSchedule } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const WEEKDAY = new Intl.DateTimeFormat("sv-SE", { weekday: "short", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("sv-SE", { day: "numeric", timeZone: "UTC" });
const LONG_DAY = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * Read-only coverage grid. No request/accept workflow by design — a manager
 * who wants cover contacts the person, so their phone and email are shown.
 * Those come from our own User record; nothing personal from TooEasy is used.
 */
export default async function TeamSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ off?: string; refresh?: string }>;
}) {
  const user = await requireUser("/team-schedule");

  // OWNER and ADMIN only — STAFF gets a 404 rather than a view of everyone's
  // whereabouts.
  if (!canViewTeamSchedule(user.role)) notFound();

  const { off, refresh } = await searchParams;
  const outcome = await getTeamSchedule(user, { skipCache: refresh === "1" });

  if (!outcome.ok) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <h1 className="text-xl font-semibold tracking-tight">Teamschema</h1>
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-danger bg-raised p-5 text-danger"
        >
          <p className="font-semibold">Schemat kunde inte hämtas</p>
          <p className="mt-1 text-sm">
            Ingen är nödvändigtvis ledig — vi når bara inte {outcome.providerName}.
          </p>
          <p className="mt-2 font-mono text-xs text-danger">{outcome.error}</p>
          <Link
            href="/team-schedule?refresh=1"
            className="mt-3 inline-flex min-h-tap items-center rounded-xl border border-danger px-4 text-sm font-medium transition hover:bg-raised"
          >
            Försök igen
          </Link>
        </div>
      </main>
    );
  }

  const { regions, days, members, shiftsByUserDay } = outcome.data;

  // Only days inside the window can be filtered on, so a hand-edited query
  // string cannot widen anything.
  const offDay = days.find((day) => day.key === off) ?? null;
  const visibleMembers = offDay
    ? members.filter((member) => (shiftsByUserDay.get(`${member.id}|${offDay.key}`) ?? []).length === 0)
    : members;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Teamschema</h1>
        <Link
          href={`/team-schedule?refresh=1${offDay ? `&off=${offDay.key}` : ""}`}
          className="inline-flex min-h-tap items-center text-sm text-muted underline underline-offset-4 transition hover:text-ink"
        >
          Uppdatera
        </Link>
      </div>
      <p className="mt-1 text-muted">
        {regions.length > 0 ? regions.join(", ") : "Ingen region satt"} · {members.length} personer
        · {days.length} dagar
      </p>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm font-medium">Vem är ledig?</p>
        <p className="mt-0.5 text-sm text-muted">
          Välj en dag för att bara visa de som inte har pass — de kan tillfrågas om att täcka
          någon annanstans.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/team-schedule"
            aria-current={offDay ? undefined : "true"}
            className={`h-9 rounded-full border px-4 text-sm font-medium leading-[2rem] transition ${
              offDay
                ? "border-control bg-surface text-muted hover:border-control"
                : "border-primary bg-raised font-semibold text-ink ring-1 ring-primary"
            }`}
          >
            Alla
          </Link>
          {days.map((day) => (
            <Link
              key={day.key}
              href={`/team-schedule?off=${day.key}`}
              aria-current={offDay?.key === day.key ? "true" : undefined}
              className={`h-9 rounded-full border px-3 text-sm font-medium leading-[2rem] transition ${
                offDay?.key === day.key
                  ? "border-primary bg-raised font-semibold text-ink ring-1 ring-primary"
                  : "border-control bg-surface text-muted hover:border-control"
              }`}
            >
              <span className="capitalize">{WEEKDAY.format(day.date)}</span>{" "}
              <span className="tabular-nums">{DAY.format(day.date)}</span>
            </Link>
          ))}
        </div>
        {offDay ? (
          <p className="mt-3 text-sm">
            Visar <strong>{visibleMembers.length}</strong> som är lediga{" "}
            <span className="capitalize">{LONG_DAY.format(offDay.date)}</span>.
          </p>
        ) : null}
      </section>

      {visibleMembers.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-control p-6 text-center text-muted">
          {offDay
            ? "Alla i regionen har pass den dagen."
            : "Inga medarbetare kopplade till butikerna i din region."}
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-semibold">
                  Medarbetare
                </th>
                {days.map((day) => (
                  <th
                    key={day.key}
                    className={`px-2 py-2 text-center font-medium ${
                      offDay?.key === day.key ? "bg-raised text-ink" : "text-muted"
                    }`}
                  >
                    <span className="block capitalize">{WEEKDAY.format(day.date)}</span>
                    <span className="block text-xs tabular-nums">{DAY.format(day.date)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((member) => (
                <tr key={member.id} className="border-b border-line last:border-b-0">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2 align-top">
                    <span className="block font-medium">{member.name ?? member.email}</span>
                    <span className="block text-xs text-muted">
                      {member.storeNames.join(", ")}
                    </span>
                    <span className="mt-0.5 block text-xs">
                      {member.phone ? (
                        <a
                          href={`tel:${member.phone.replace(/\s/g, "")}`}
                          className="text-muted underline underline-offset-2"
                        >
                          {member.phone}
                        </a>
                      ) : (
                        <a
                          href={`mailto:${member.email}`}
                          className="text-muted underline underline-offset-2"
                        >
                          {member.email}
                        </a>
                      )}
                    </span>
                  </td>

                  {days.map((day) => {
                    const shifts = shiftsByUserDay.get(`${member.id}|${day.key}`) ?? [];
                    const isOff = shifts.length === 0;
                    return (
                      <td
                        key={day.key}
                        className={`px-2 py-2 text-center align-top ${
                          offDay?.key === day.key ? "bg-raised" : ""
                        }`}
                      >
                        {isOff ? (
                          <span className="text-xs font-medium text-muted">Ledig</span>
                        ) : (
                          shifts.map((shift) => (
                            <span
                              key={`${shift.startTime}-${shift.storeName}`}
                              className="mb-1 block rounded-md bg-raised px-1 py-0.5 text-xs text-primary"
                            >
                              <span className="block font-medium">{shift.storeName}</span>
                              <span className="block tabular-nums">
                                {shift.startTime}–{shift.endTime}
                              </span>
                            </span>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        Källa: {outcome.providerName}. Kontaktuppgifter kommer från våra egna konton.
      </p>
    </main>
  );
}
