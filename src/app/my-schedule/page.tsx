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
          className="text-sm text-zinc-500 underline underline-offset-4 transition hover:text-zinc-900"
        >
          Uppdatera
        </Link>
      </div>
      <p className="mt-1 text-zinc-600">Dina pass de närmaste {SCHEDULE_DAYS} dagarna.</p>

      {!outcome.ok ? (
        // Deliberately distinct from the empty state: an outage must never
        // read as "you are not working".
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900"
        >
          <p className="font-semibold">Schemat kunde inte hämtas</p>
          <p className="mt-1 text-sm">
            Det här betyder <strong>inte</strong> att du är ledig — vi når bara inte{" "}
            {outcome.providerName} just nu.
          </p>
          <p className="mt-2 font-mono text-xs text-red-800">{outcome.error}</p>
          <Link
            href="/my-schedule?refresh=1"
            className="mt-3 inline-flex h-10 items-center rounded-xl border border-red-300 px-4 text-sm font-medium transition hover:bg-red-100"
          >
            Försök igen
          </Link>
        </div>
      ) : outcome.data.entries.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center">
          <p className="font-medium text-zinc-700">
            Inga pass de närmaste {SCHEDULE_DAYS} dagarna
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Schemat lästes från {outcome.providerName}.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {outcome.data.entries.map((entry) => (
            <li
              key={`${entry.date.toISOString()}-${entry.startTime}-${entry.storeId}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-medium capitalize">
                  {WEEKDAY.format(entry.date)}{" "}
                  <span className="text-zinc-400">{DAY.format(entry.date)}</span>
                </p>
                <p className="text-sm text-zinc-500">{entry.storeName}</p>
              </div>
              <p className="shrink-0 font-medium tabular-nums">
                {entry.startTime}–{entry.endTime}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-zinc-400">Källa: {outcome.providerName}.</p>
    </main>
  );
}
