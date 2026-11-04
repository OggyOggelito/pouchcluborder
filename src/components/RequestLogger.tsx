"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  findSimilarAction,
  incrementRequestAction,
  logRequestAction,
  type LogRequestState,
} from "@/lib/request-actions";
import {
  MAX_TEXT_LENGTH,
  NO_PERSONAL_DATA_NOTICE,
  REQUEST_KINDS,
  REQUEST_KIND_HELP,
  REQUEST_KIND_LABELS,
  type RequestKind,
} from "@/lib/customer-requests";
import type { StoreSummary } from "@/lib/repositories/stores";

type Similar = {
  id: string;
  brandText: string | null;
  flavorText: string | null;
  kind: RequestKind;
  count: number;
  lastSeenAt: string;
};

type ProductHit = { id: string; label: string };

const FIELD =
  "mt-1 h-12 w-full rounded-2xl border border-zinc-200 px-4 text-base outline-none transition focus:border-zinc-400";

/**
 * One screen: pick what kind, type what the customer asked for, send.
 *
 * As you type, requests already logged in this store appear with "+1 till", so
 * the count goes up instead of the list filling with near-duplicates.
 */
export default function RequestLogger({
  stores,
  initialText,
  products,
}: {
  stores: StoreSummary[];
  initialText: string;
  /** Catalog for the OUT_OF_STOCK product link, filtered in the browser. */
  products: ProductHit[];
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [kind, setKind] = useState<RequestKind>(initialText ? "NOT_STOCKED" : "NOT_STOCKED");
  const [brandText, setBrandText] = useState(initialText);
  const [flavorText, setFlavorText] = useState("");
  const [productId, setProductId] = useState("");
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [, startLookup] = useTransition();

  const [logState, logAction, logging] = useActionState<LogRequestState, FormData>(
    logRequestAction,
    { error: null, confirmation: null }
  );
  const [bumpState, bumpAction] = useActionState<LogRequestState, FormData>(
    incrementRequestAction,
    { error: null, confirmation: null }
  );

  const state = bumpState.confirmation || bumpState.error ? bumpState : logState;

  // Look up near-duplicates while typing, debounced.
  useEffect(() => {
    if (!storeId || (!brandText.trim() && !flavorText.trim())) {
      setSimilar([]);
      return;
    }
    const timer = setTimeout(() => {
      startLookup(async () => {
        setSimilar(await findSimilarAction({ storeId, brandText, flavorText }));
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [storeId, brandText, flavorText]);

  const productHits =
    kind === "OUT_OF_STOCK" && brandText.trim().length >= 2
      ? products
          .filter((product) => product.label.toLowerCase().includes(brandText.toLowerCase()))
          .slice(0, 6)
      : [];

  if (state.confirmation) {
    // Staff see a confirmation only — never the ranking.
    return (
      <section className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
        <p className="text-lg font-medium text-brand-700">{state.confirmation}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/requests/new"
            className="flex h-12 items-center justify-center rounded-2xl bg-zinc-900 font-semibold text-white"
          >
            Logga ett till
          </Link>
          <Link
            href="/staff"
            className="flex h-12 items-center justify-center rounded-2xl border border-zinc-200 font-medium"
          >
            Klar
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form action={logAction} className="mt-5 space-y-5">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="productId" value={productId} />

      {stores.length > 1 ? (
        <div>
          <label htmlFor="store" className="block text-sm font-medium text-zinc-700">Butik</label>
          <select
            id="store"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            className={FIELD}
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium text-zinc-700">Vad gäller det?</legend>
        <div className="mt-2 grid gap-2">
          {REQUEST_KINDS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => {
                setKind(candidate);
                if (candidate !== "OUT_OF_STOCK") setProductId("");
              }}
              aria-pressed={kind === candidate}
              className={`min-h-14 rounded-2xl border px-4 py-3 text-left transition ${
                kind === candidate
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              <span className="block font-medium">{REQUEST_KIND_LABELS[candidate]}</span>
              <span className={`block text-sm ${kind === candidate ? "text-zinc-300" : "text-zinc-500"}`}>
                {REQUEST_KIND_HELP[candidate]}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="brandText" className="block text-sm font-medium text-zinc-700">
          Märke eller produkt
        </label>
        <input
          id="brandText"
          name="brandText"
          value={brandText}
          onChange={(event) => setBrandText(event.target.value)}
          maxLength={MAX_TEXT_LENGTH}
          placeholder="t.ex. Nordic Spirit"
          className={FIELD}
        />
      </div>

      {productHits.length > 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <p className="text-sm font-medium">Koppla till en produkt i katalogen</p>
          <ul className="mt-2 space-y-1">
            {productHits.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => setProductId(productId === product.id ? "" : product.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    productId === product.id
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200"
                  }`}
                >
                  {product.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <label htmlFor="flavorText" className="block text-sm font-medium text-zinc-700">
          Smak (valfritt)
        </label>
        <input
          id="flavorText"
          name="flavorText"
          value={flavorText}
          onChange={(event) => setFlavorText(event.target.value)}
          maxLength={MAX_TEXT_LENGTH}
          placeholder="t.ex. Mint"
          className={FIELD}
        />
        <p className="mt-2 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-600">
          {NO_PERSONAL_DATA_NOTICE}
        </p>
      </div>

      {similar.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Redan loggat i den här butiken — lägg hellre till en till:
          </p>
          <ul className="mt-2 space-y-2">
            {similar.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">
                    {[row.brandText, row.flavorText].filter(Boolean).join(" ") || "—"}
                  </span>
                  <span className="block text-xs text-amber-800">
                    {REQUEST_KIND_LABELS[row.kind]} · {row.count} gånger
                  </span>
                </span>
                <button
                  type="submit"
                  formAction={bumpAction}
                  name="requestId"
                  value={row.id}
                  className="h-10 shrink-0 rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white"
                >
                  +1 till
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={logging}
        className="h-14 w-full rounded-2xl bg-zinc-900 px-6 text-lg font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-400"
      >
        {logging ? "Sparar…" : "Logga önskemålet"}
      </button>
    </form>
  );
}
