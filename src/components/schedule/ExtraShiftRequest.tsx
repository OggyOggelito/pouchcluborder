"use client";

import { useActionState, useState } from "react";
import { createExtraShiftRequestAction } from "@/lib/extra-shift-actions";
import { EXTRA_SHIFT_NOTICE, MAX_EXTRA_SHIFT_NOTE_LENGTH } from "@/lib/schedule/extra-shifts";
import { NO_PERSONAL_DATA_SHORT } from "@/lib/privacy";
import { formatLongDateString } from "@/lib/schedule/time";

/**
 * Asking one store to lend one person, on one day.
 *
 * Collapsed until asked for: the list is for scanning who is free, and seven
 * open forms is not a list. The times come prefilled from whatever the manager
 * filtered on, or from the store's own opening hours for that day, so the
 * common case is one tap and send.
 */
export default function ExtraShiftRequest({
  requestingStoreId,
  employeeId,
  employeeName,
  homeStoreName,
  date,
  defaultStartsAt,
  defaultEndsAt,
  alreadyAsked,
}: {
  requestingStoreId: string;
  employeeId: string;
  employeeName: string;
  homeStoreName: string;
  date: string;
  defaultStartsAt: string;
  defaultEndsAt: string;
  alreadyAsked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createExtraShiftRequestAction, {
    error: null,
  });

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      {/* Stacked on a phone: a name and a button side by side at 390px wraps
          the name mid-word, and a name is the one thing on this card that has
          to be read cleanly. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <span className="min-w-0">
          <span className="block font-medium">{employeeName}</span>
          <span className="block text-sm text-muted">{homeStoreName} · ledig</span>
        </span>

        {alreadyAsked ? (
          <span className="shrink-0 text-sm text-muted">Förfrågan skickad</span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className={`min-h-tap shrink-0 rounded-2xl px-4 text-sm font-semibold transition ${
              open
                ? "border border-control text-ink"
                : "bg-primary text-on-primary active:scale-[0.99]"
            }`}
          >
            {open ? "Avbryt" : "Fråga om extrapass"}
          </button>
        )}
      </div>

      {open ? (
        <form action={action} className="mt-4 border-t border-line pt-4">
          <input type="hidden" name="requestingStoreId" value={requestingStoreId} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="date" value={date} />

          <p className="text-sm capitalize text-muted">{formatLongDateString(date)}</p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block font-medium">Från</span>
              <input
                type="time"
                name="startsAt"
                defaultValue={defaultStartsAt}
                required
                className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
              />
            </label>
            <label className="block text-sm">
              <span className="block font-medium">Till</span>
              <input
                type="time"
                name="endsAt"
                defaultValue={defaultEndsAt}
                required
                className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
              />
            </label>
          </div>

          <label className="mt-3 block text-sm">
            <span className="block font-medium">Meddelande till butiken</span>
            <textarea
              name="note"
              rows={2}
              maxLength={MAX_EXTRA_SHIFT_NOTE_LENGTH}
              placeholder="T.ex. lagerdag, vi är en kort"
              className="mt-1 w-full rounded-xl border border-control bg-raised px-3 py-2"
            />
            <span className="mt-1 block text-xs text-muted">{NO_PERSONAL_DATA_SHORT}</span>
          </label>

          <p className="mt-3 text-xs text-muted">{EXTRA_SHIFT_NOTICE}</p>

          {state.error ? (
            <p role="alert" className="mt-3 rounded-xl border border-danger bg-raised p-3 text-sm text-danger">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-3 min-h-tap w-full rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99] disabled:opacity-50"
          >
            {pending ? "Skickar…" : `Skicka förfrågan till ${homeStoreName}`}
          </button>
        </form>
      ) : null}
    </div>
  );
}
