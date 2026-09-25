import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { getMyShifts, SCHEDULE_DAYS } from "@/lib/schedule/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const WEEKDAY = new Intl.DateTimeFormat("sv-SE", { weekday: "long", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function MySchedulePage() {
  const user = await requireUser("/my-schedule");
  const { entries, providerName } = await getMyShifts(user.id);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Mitt schema</h1>
      <p className="mt-1 text-zinc-600">
        Dina pass de närmaste {SCHEDULE_DAYS} dagarna.
      </p>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center">
          <p className="text-zinc-500">Inga pass inlagda för perioden.</p>
          <p className="mt-2 text-sm text-zinc-400">
            Schemat läses från <span className="font-medium">{providerName}</span>. Saknas dina
            pass är det troligen för att den senaste filen inte importerats än.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {entries.map((entry) => (
            <li
              key={`${entry.date.toISOString()}-${entry.startTime}`}
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

      <p className="mt-6 text-xs text-zinc-400">Källa: {providerName}.</p>

      <Link
        href="/news"
        className="mt-6 inline-flex text-sm text-zinc-500 underline underline-offset-4"
      >
        Till nyheter
      </Link>
    </main>
  );
}
