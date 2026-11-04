"use client";

import { useActionState, useMemo, useState } from "react";
import { createTransferAction, type TransferFormState } from "@/lib/transfer-actions";
import { NO_RESERVATION_NOTICE, TRANSFER_UNITS, TRANSFER_UNIT_LABELS } from "@/lib/transfers";
import type { StoreSummary } from "@/lib/repositories/stores";

type ProductHit = { id: string; label: string };
type Line = { productId: string; label: string; quantity: number; unit: string };

const FIELD =
  "mt-1 h-12 w-full rounded-2xl border border-zinc-200 px-4 text-base outline-none transition focus:border-zinc-400";

export default function TransferBuilder({
  stores,
  regionStores,
  allStores,
  isAdmin,
  products,
}: {
  /** Stores the user may request on behalf of. */
  stores: StoreSummary[];
  /** Other stores in the same region — the default audience. */
  regionStores: StoreSummary[];
  /** Every store; an admin may target outside the region. */
  allStores: StoreSummary[];
  isAdmin: boolean;
  products: ProductHit[];
}) {
  const [requestingStoreId, setRequestingStoreId] = useState(stores[0]?.id ?? "");
  const [targetStoreId, setTargetStoreId] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [state, formAction, pending] = useActionState<TransferFormState, FormData>(
    createTransferAction,
    { error: null }
  );

  const hits = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (text.length < 2) return [];
    return products
      .filter((product) => product.label.toLowerCase().includes(text))
      .filter((product) => !lines.some((line) => line.productId === product.id))
      .slice(0, 8);
  }, [products, query, lines]);

  // An admin may reach outside the region; everyone else sees their region.
  const targetable = isAdmin
    ? allStores.filter((store) => store.id !== requestingStoreId)
    : regionStores;

  return (
    <form action={formAction} className="mt-5 space-y-5">
      <input type="hidden" name="requestingStoreId" value={requestingStoreId} />

      {stores.length > 1 ? (
        <div>
          <label htmlFor="from" className="block text-sm font-medium text-zinc-700">
            Vi som frågar
          </label>
          <select
            id="from"
            value={requestingStoreId}
            onChange={(event) => setRequestingStoreId(event.target.value)}
            className={FIELD}
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label htmlFor="target" className="block text-sm font-medium text-zinc-700">
          Fråga
        </label>
        <select
          id="target"
          name="targetStoreId"
          value={targetStoreId}
          onChange={(event) => setTargetStoreId(event.target.value)}
          className={FIELD}
        >
          <option value="">Alla butiker i regionen</option>
          {targetable.map((store) => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>
        <p className="mt-1 text-sm text-zinc-500">
          {targetStoreId
            ? "Bara den butiken ser förfrågan."
            : targetable.length === 0
              ? "Det finns ingen annan butik i din region än — välj en butik direkt, eller be en administratör."
              : `Öppen förfrågan: ${targetable.length} butik(er) i regionen kan svara. Först till kvarn.`}
        </p>
      </div>

      <div>
        <label htmlFor="product" className="block text-sm font-medium text-zinc-700">
          Lägg till produkt
        </label>
        <input
          id="product"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök märke eller smak…"
          className={FIELD}
        />
        {hits.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => {
                    setLines((current) => [
                      ...current,
                      { productId: hit.id, label: hit.label, quantity: 1, unit: "STOCK" },
                    ]);
                    setQuery("");
                  }}
                  className="min-h-12 w-full rounded-xl border border-zinc-200 px-3 py-2 text-left text-sm transition hover:border-zinc-300"
                >
                  {hit.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {lines.length > 0 ? (
        <ul className="space-y-2">
          {lines.map((line, index) => (
            <li
              key={line.productId}
              className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"
            >
              <input type="hidden" name="productId" value={line.productId} />
              <p className="font-medium">{line.label}</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, quantity: Math.max(1, Number(event.target.value)) }
                          : row
                      )
                    )
                  }
                  aria-label={`Antal ${line.label}`}
                  className="h-12 w-24 rounded-xl border border-zinc-200 px-3 text-center text-base tabular-nums"
                />
                {/* The unit is stored, never assumed. */}
                <select
                  name="unit"
                  value={line.unit}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, unit: event.target.value } : row
                      )
                    )
                  }
                  aria-label={`Enhet ${line.label}`}
                  className="h-12 rounded-xl border border-zinc-200 px-3 text-base"
                >
                  {TRANSFER_UNITS.map((unit) => (
                    <option key={unit} value={unit}>{TRANSFER_UNIT_LABELS[unit]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  className="ml-auto h-12 rounded-xl border border-red-200 px-4 text-sm text-red-700"
                >
                  Ta bort
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <label htmlFor="note" className="block text-sm font-medium text-zinc-700">
          Meddelande (valfritt)
        </label>
        <textarea id="note" name="note" rows={2} className={`${FIELD} h-auto py-2`} />
      </div>

      <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-600">{NO_RESERVATION_NOTICE}</p>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || lines.length === 0}
        className="h-14 w-full rounded-2xl bg-zinc-900 px-6 text-lg font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-500"
      >
        {pending ? "Skickar…" : "Skicka förfrågan"}
      </button>
    </form>
  );
}
