"use client";

import { useActionState, useState } from "react";
import { createPauseAction, type PauseState } from "@/lib/order-pause-actions";
import { MAX_PAUSE_MESSAGE, PAUSE_SCOPES, PAUSE_SCOPE_LABELS, type PauseScope } from "@/lib/order-pause";

/**
 * Starting a pause, now or later.
 *
 * The message is required. A pause with no explanation turns into five phone
 * calls to the office, and the message is the only thing a store sees.
 */
export default function OrderPauseForm({
  stores,
  brands,
}: {
  stores: { id: string; name: string }[];
  brands: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<PauseState, FormData>(createPauseAction, {
    error: null,
  });
  const [scope, setScope] = useState<PauseScope>("ALL");

  return (
    <form action={formAction} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="font-semibold tracking-tight">Pausa beställningar</h2>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium">Omfattning</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PAUSE_SCOPES.map((candidate) => (
            <label
              key={candidate}
              className={`min-h-tap cursor-pointer rounded-full border px-4 text-sm leading-[2.75rem] transition ${
                scope === candidate
                  ? "border-primary bg-raised font-semibold ring-1 ring-primary"
                  : "border-control bg-surface font-medium text-muted"
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={candidate}
                checked={scope === candidate}
                onChange={() => setScope(candidate)}
                className="sr-only"
              />
              {PAUSE_SCOPE_LABELS[candidate]}
            </label>
          ))}
        </div>
      </fieldset>

      {scope === "STORE" ? (
        <label className="mt-3 block text-sm">
          <span className="block font-medium">Butik</span>
          <select
            name="storeId"
            className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {scope === "BRAND" ? (
        <label className="mt-3 block text-sm">
          <span className="block font-medium">Varumärke</span>
          <select
            name="brandId"
            className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
          >
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            Stoppar bara beställningar som innehåller det märket. Allt annat går som vanligt.
          </span>
        </label>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="block font-medium">Startar</span>
          <input
            type="datetime-local"
            name="startsAt"
            className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
          />
          <span className="mt-1 block text-xs text-muted">Tomt betyder nu.</span>
        </label>
        <label className="block text-sm">
          <span className="block font-medium">Slutar</span>
          <input
            type="datetime-local"
            name="endsAt"
            className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
          />
          <span className="mt-1 block text-xs text-muted">Tomt betyder tills den lyfts.</span>
        </label>
      </div>

      <label className="mt-3 block text-sm">
        <span className="block font-medium">Meddelande till butikerna</span>
        <textarea
          name="message"
          rows={2}
          required
          maxLength={MAX_PAUSE_MESSAGE}
          placeholder="T.ex. leverantörsbyte, vi öppnar igen 1 dec"
          className="mt-1 w-full rounded-xl border border-control bg-raised px-3 py-2"
        />
        <span className="mt-1 block text-xs text-muted">Max {MAX_PAUSE_MESSAGE} tecken.</span>
      </label>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-xl border border-danger bg-raised p-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 min-h-tap w-full rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Sparar…" : "Pausa"}
      </button>
    </form>
  );
}
