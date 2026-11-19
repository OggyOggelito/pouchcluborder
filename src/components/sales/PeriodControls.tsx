import Link from "next/link";
import { GRANULARITY_LABELS, type Granularity } from "@/lib/sales/aggregate";
import { PERIODS, PERIOD_LABELS, type PeriodKey } from "@/lib/sales-periods";

/**
 * Period and grain, as links rather than a form.
 *
 * The state is in the URL, so a supplier can send "the last 30 days per week"
 * to a colleague and it is still that. Also means the page is a plain server
 * render with no client state to get out of step with what is shown.
 */
export default function PeriodControls({
  basePath,
  period,
  granularity,
  from,
  to,
  extra = {},
}: {
  basePath: string;
  period: PeriodKey;
  granularity: Granularity;
  from: string;
  to: string;
  extra?: Record<string, string>;
}) {
  const href = (patch: Record<string, string>) => {
    const params = new URLSearchParams({
      period,
      gran: granularity,
      fran: from,
      till: to,
      ...extra,
      ...patch,
    });
    return `${basePath}?${params.toString()}`;
  };

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Period">
        {PERIODS.map((candidate) => (
          <Link
            key={candidate}
            href={href({ period: candidate })}
            aria-current={candidate === period ? "true" : undefined}
            className={`min-h-tap rounded-full border px-4 text-sm leading-[2.75rem] transition ${
              candidate === period
                ? "border-primary bg-raised font-semibold ring-1 ring-primary"
                : "border-control bg-surface font-medium text-muted hover:border-control"
            }`}
          >
            {PERIOD_LABELS[candidate]}
          </Link>
        ))}
      </div>

      {period === "custom" ? (
        <form method="get" action={basePath} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="period" value="custom" />
          <input type="hidden" name="gran" value={granularity} />
          {Object.entries(extra).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <label className="text-sm">
            <span className="block font-medium">Från</span>
            <input
              type="date"
              name="fran"
              defaultValue={from}
              className="mt-1 min-h-tap w-40 rounded-xl border border-control bg-raised px-3 tabular-nums"
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium">Till</span>
            <input
              type="date"
              name="till"
              defaultValue={to}
              className="mt-1 min-h-tap w-40 rounded-xl border border-control bg-raised px-3 tabular-nums"
            />
          </label>
          <button
            type="submit"
            className="min-h-tap rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
          >
            Visa
          </button>
        </form>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Upplösning">
        {(["day", "week", "month"] as Granularity[]).map((candidate) => (
          <Link
            key={candidate}
            href={href({ gran: candidate })}
            aria-current={candidate === granularity ? "true" : undefined}
            className={`min-h-tap rounded-full border px-4 text-sm leading-[2.75rem] transition ${
              candidate === granularity
                ? "border-primary bg-raised font-semibold ring-1 ring-primary"
                : "border-control bg-surface font-medium text-muted"
            }`}
          >
            {GRANULARITY_LABELS[candidate]}
          </Link>
        ))}
      </div>

      <p className="mt-3 text-sm text-muted">
        {from} – {to}
      </p>
    </>
  );
}
