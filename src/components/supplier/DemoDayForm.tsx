"use client";

import { useActionState, useState } from "react";
import { bookDemoDayAction, type BookingState } from "@/lib/demo-day-actions";
import {
  DEMO_NOTE_NOTICE,
  MAX_DEMO_NOTE_LENGTH,
  type StoreOption,
} from "@/lib/demo-days";

/**
 * Booking a demo day.
 *
 * The date is picked first, because every store's answer depends on it: the
 * list below reloads with that day's opening hours and says which shops are
 * closed or already taken. "Alla butiker" ticks the ones that can be booked
 * and nothing else, so the shortcut cannot quietly ask for a shut shop.
 *
 * There is no brand field. The brand comes from the session, server-side.
 */
export default function DemoDayForm({
  date,
  options,
  onDateChange,
  min,
  max,
}: {
  date: string;
  options: StoreOption[];
  onDateChange: (date: string) => void;
  min: string;
  max: string;
}) {
  const [state, formAction, pending] = useActionState<BookingState, FormData>(
    bookDemoDayAction,
    { error: null }
  );

  const bookable = options.filter((option) => option.blockedReason === null);
  const [picked, setPicked] = useState<string[]>([]);

  const allPicked = bookable.length > 0 && picked.length === bookable.length;

  function toggle(storeId: string) {
    setPicked((current) =>
      current.includes(storeId)
        ? current.filter((id) => id !== storeId)
        : [...current, storeId]
    );
  }

  return (
    <form action={formAction} className="mt-6">
      <label className="block text-sm">
        <span className="block font-medium">Datum</span>
        <input
          type="date"
          name="date"
          value={date}
          min={min}
          max={max}
          required
          onChange={(event) => {
            setPicked([]);
            onDateChange(event.target.value);
          }}
          className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
        />
      </label>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Butiker</legend>

        {bookable.length > 1 ? (
          <button
            type="button"
            onClick={() => setPicked(allPicked ? [] : bookable.map((option) => option.storeId))}
            className="mt-2 min-h-tap rounded-full border border-control px-4 text-sm font-medium transition hover:border-primary"
          >
            {allPicked ? "Avmarkera alla" : `Alla butiker (${bookable.length})`}
          </button>
        ) : null}

        <ul className="mt-3 space-y-2">
          {options.map((option) => {
            const blocked = option.blockedReason !== null;
            return (
              <li key={option.storeId}>
                <label
                  className={`flex min-h-tap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                    blocked
                      ? "border-line bg-surface opacity-60"
                      : "border-control bg-surface hover:border-primary"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      name="storeId"
                      value={option.storeId}
                      disabled={blocked}
                      checked={picked.includes(option.storeId)}
                      onChange={() => toggle(option.storeId)}
                      className="size-5 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{option.storeName}</span>
                      <span className="block text-sm text-muted">
                        {blocked
                          ? option.blockedReason
                          : `Öppet ${option.opensAt}–${option.closesAt}`}
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {bookable.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-warning bg-raised p-4 text-sm text-warning">
            <span className="sr-only">Varning:</span>
            <span aria-hidden>⚠ </span>Ingen butik går att boka den dagen. Välj ett annat datum.
          </p>
        ) : null}
      </fieldset>

      <label className="mt-6 block text-sm">
        <span className="block font-medium">Meddelande till butiken</span>
        <textarea
          name="note"
          rows={3}
          maxLength={MAX_DEMO_NOTE_LENGTH}
          placeholder="T.ex. vi tar med smakprover och en roll-up"
          className="mt-1 w-full rounded-xl border border-control bg-raised px-3 py-2"
        />
        <span className="mt-1 block text-xs text-muted">
          {DEMO_NOTE_NOTICE} Max {MAX_DEMO_NOTE_LENGTH} tecken.
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger bg-raised p-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || picked.length === 0}
        className="mt-6 min-h-14 w-full rounded-2xl bg-primary px-6 font-semibold text-on-primary transition active:scale-[0.99] disabled:bg-raised disabled:text-muted"
      >
        {pending
          ? "Skickar…"
          : picked.length === 0
            ? "Välj minst en butik"
            : `Skicka förfrågan (${picked.length})`}
      </button>

      <p className="mt-3 text-xs text-muted">
        Butiken svarar ja eller nej per butik. Du ser svaret här i portalen.
      </p>
    </form>
  );
}
