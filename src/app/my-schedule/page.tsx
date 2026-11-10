import Link from "next/link";
import { getMyShifts, SCHEDULE_DAYS } from "@/lib/schedule/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const WEEKDAY = new Intl.DateTimeFormat("sv-SE", { weekday: "long", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ refresh?: string }>;
}) {
  const user = await requireUser("/my-schedule");
  const { refresh } = await searchParams;

  const outcome = await getMyShifts(user.id, { skipCache: refresh === "1" });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Mitt schema</h1>
        <Link
          href="/my-schedule?refresh=1"
          className="inline-flex min-h-tap items-center text-sm text-muted underline underline-offset-4 transition hover:text-ink"
        >
          Uppdatera
        </Link>
      </div>
      <p className="mt-1 text-muted">Dina pass de närmaste {SCHEDULE_DAYS} dagarna.</p>

      {!outcome.ok ? (
        // Deliberately distinct from the empty state: an outage must never
        // read as "you are not working".
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-danger bg-raised p-5 text-danger"
        >
          <p className="font-semibold">Schemat kunde inte hämtas</p>
          <p className="mt-1 text-sm">
            Det här betyder <strong>inte</strong> att du är ledig — vi når bara inte{" "}
            {outcome.providerName} just nu.
          </p>
          <p className="mt-2 font-mono text-xs text-danger">{outcome.error}</p>
          <Link
            href="/my-schedule?refresh=1"
            className="mt-3 inline-flex min-h-tap items-center rounded-xl border border-danger px-4 text-sm font-medium transition hover:bg-raised"
          >
            Försök igen
          </Link>
        </div>
      ) : outcome.data.entries.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-control p-6 text-center">
          <p className="font-medium text-ink">
            Inga pass de närmaste {SCHEDULE_DAYS} dagarna
          </p>
          <p className="mt-1 text-sm text-muted">
            Schemat lästes från {outcome.providerName}.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {outcome.data.entries.map((entry) => (
            <li
              key={`${entry.date.toISOString()}-${entry.startTime}-${entry.storeId}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-medium capitalize">
                  {WEEKDAY.format(entry.date)}{" "}
                  <span className="text-muted">{DAY.format(entry.date)}</span>
                </p>
                <p className="text-sm text-muted">{entry.storeName}</p>
              </div>
              <p className="shrink-0 font-medium tabular-nums">
                {entry.startTime}–{entry.endTime}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted">Källa: {outcome.providerName}.</p>
    </main>
  );
}
