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
  "mt-1 h-12 w-full bg-raised rounded-2xl border border-control px-4 text-base text-ink placeholder:text-muted outline-none transition focus:border-primary";

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
      <section className="mt-6 rounded-2xl border border-primary bg-raised p-6 text-center">
        <p className="text-lg font-medium text-primary">{state.confirmation}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/requests/new"
            className="flex h-12 items-center justify-center rounded-2xl bg-primary font-semibold text-on-primary"
          >
            Logga ett till
          </Link>
          <Link
            href="/staff"
            className="flex h-12 items-center justify-center rounded-2xl border border-line font-medium"
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
          <label htmlFor="store" className="block text-sm font-medium text-ink">Butik</label>
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
        <legend className="text-sm font-medium text-ink">Vad gäller det?</legend>
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
                  ? "border-primary bg-raised font-semibold text-ink ring-1 ring-primary"
                  : "border-line bg-surface hover:border-control"
              }`}
            >
              <span className="block font-medium">{REQUEST_KIND_LABELS[candidate]}</span>
              <span className={`block text-sm ${kind === candidate ? "text-muted" : "text-muted"}`}>
                {REQUEST_KIND_HELP[candidate]}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="brandText" className="block text-sm font-medium text-ink">
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
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-sm font-medium">Koppla till en produkt i katalogen</p>
          <ul className="mt-2 space-y-1">
            {productHits.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => setProductId(productId === product.id ? "" : product.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    productId === product.id
                      ? "border-primary bg-raised font-semibold text-ink ring-1 ring-primary"
                      : "border-line"
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
        <label htmlFor="flavorText" className="block text-sm font-medium text-ink">
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
        <p className="mt-2 rounded-xl bg-raised p-3 text-sm text-muted">
          {NO_PERSONAL_DATA_NOTICE}
        </p>
      </div>

      {similar.length > 0 ? (
        <section className="rounded-2xl border border-warning bg-raised p-4">
          <p className="text-sm font-medium text-warning">
            Redan loggat i den här butiken — lägg hellre till en till:
          </p>
          <ul className="mt-2 space-y-2">
            {similar.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">
                    {[row.brandText, row.flavorText].filter(Boolean).join(" ") || "—"}
                  </span>
                  <span className="block text-xs text-warning">
                    {REQUEST_KIND_LABELS[row.kind]} · {row.count} gånger
                  </span>
                </span>
                <button
                  type="submit"
                  formAction={bumpAction}
                  name="requestId"
                  value={row.id}
                  className="min-h-tap shrink-0 rounded-xl bg-warning px-4 text-sm font-semibold text-on-primary"
                >
                  +1 till
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-raised p-3 text-sm text-danger">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={logging}
        className="h-14 w-full rounded-2xl bg-primary px-6 text-lg font-semibold text-on-primary transition active:scale-[0.99] disabled:bg-raised disabled:text-muted"
      >
        {logging ? "Sparar…" : "Logga önskemålet"}
      </button>
    </form>
  );
}
