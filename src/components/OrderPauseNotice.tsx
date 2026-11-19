import {
  PAUSE_STILL_WORKS,
  describePause,
  describeScheduled,
  type PauseRow,
} from "@/lib/order-pause";

/**
 * The pause banner.
 *
 * Says what is stopped, and — on the order screen — what is not. A store that
 * only reads "pausat" assumes the whole portal is down and rings the office;
 * the list is three lines and saves that call.
 */
export default function OrderPauseNotice({
  active,
  scheduled = [],
  explain = false,
}: {
  active: PauseRow[];
  scheduled?: PauseRow[];
  /** Include "det här fungerar ändå". On the order screen, yes. */
  explain?: boolean;
}) {
  if (active.length === 0 && scheduled.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {active.map((pause) => (
        <div
          key={pause.id}
          role="status"
          className="rounded-2xl border border-warning bg-raised p-4 text-sm text-warning"
        >
          <p className="font-semibold">
            <span className="sr-only">Varning:</span>
            <span aria-hidden="true">⚠ </span>
            {describePause(pause)}
          </p>
          {explain ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {PAUSE_STILL_WORKS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}

      {scheduled.map((pause) => (
        <p
          key={pause.id}
          className="rounded-2xl border border-info bg-raised p-4 text-sm text-info"
        >
          <span className="sr-only">Information:</span>
          <span aria-hidden="true">i </span>
          {describeScheduled(pause)}
        </p>
      ))}
    </div>
  );
}
