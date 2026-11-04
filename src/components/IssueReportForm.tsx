"use client";

import { useActionState, useState } from "react";
import { createIssueAction, type IssueFormState } from "@/lib/issue-actions";
import {
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_HELP,
  ISSUE_CATEGORY_LABELS,
  MAX_ISSUE_TEXT_LENGTH,
  type IssueCategory,
} from "@/lib/issues";
import { NO_PERSONAL_DATA_SHORT } from "@/lib/privacy";
import type { StoreSummary } from "@/lib/repositories/stores";

type ProductHit = { id: string; label: string };

const FIELD =
  "mt-1 h-12 w-full rounded-2xl border border-zinc-200 px-4 text-base outline-none transition focus:border-zinc-400";

/**
 * One screen, under a minute: category, a sentence, send.
 *
 * `prefill` lets another page hand over a store, product and text — the
 * product picker filters the catalog in the browser, like the finder does, so
 * there is no round trip per keystroke.
 */
export default function IssueReportForm({
  stores,
  products,
  prefill,
}: {
  stores: StoreSummary[];
  products: ProductHit[];
  prefill: { storeId: string; productId: string; text: string; category: IssueCategory | null };
}) {
  const [storeId, setStoreId] = useState(prefill.storeId || (stores[0]?.id ?? ""));
  const [category, setCategory] = useState<IssueCategory>(prefill.category ?? "DAMAGED_GOODS");
  const [text, setText] = useState(prefill.text);
  const [productId, setProductId] = useState(prefill.productId);
  const [productQuery, setProductQuery] = useState(
    prefill.productId ? products.find((p) => p.id === prefill.productId)?.label ?? "" : ""
  );

  const [state, formAction, pending] = useActionState<IssueFormState, FormData>(createIssueAction, {
    error: null,
  });

  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const hits =
    !selectedProduct && productQuery.trim().length >= 2
      ? products
          .filter((product) => product.label.toLowerCase().includes(productQuery.toLowerCase()))
          .slice(0, 6)
      : [];

  return (
    <form action={formAction} className="mt-5 space-y-5">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="productId" value={productId} />

      {stores.length > 1 ? (
        <div>
          <label htmlFor="issue-store" className="block text-sm font-medium text-zinc-700">
            Butik
          </label>
          <select
            id="issue-store"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            className={FIELD}
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium text-zinc-700">Vad gäller det?</legend>
        <div className="mt-2 grid gap-2">
          {ISSUE_CATEGORIES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setCategory(candidate)}
              aria-pressed={category === candidate}
              className={`min-h-14 rounded-2xl border px-4 py-3 text-left transition ${
                category === candidate
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              <span className="block font-medium">{ISSUE_CATEGORY_LABELS[candidate]}</span>
              <span
                className={`block text-sm ${
                  category === candidate ? "text-zinc-300" : "text-zinc-500"
                }`}
              >
                {ISSUE_CATEGORY_HELP[candidate]}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="issue-product" className="block text-sm font-medium text-zinc-700">
          Produkt (valfritt)
        </label>
        {selectedProduct ? (
          <div className="mt-1 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <span className="min-w-0 truncate text-[15px]">{selectedProduct.label}</span>
            <button
              type="button"
              onClick={() => {
                setProductId("");
                setProductQuery("");
              }}
              className="h-9 shrink-0 rounded-xl border border-zinc-200 px-3 text-sm font-medium"
            >
              Ta bort
            </button>
          </div>
        ) : (
          <input
            id="issue-product"
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
            placeholder="Sök i katalogen"
            className={FIELD}
          />
        )}
        {hits.length > 0 ? (
          <ul className="mt-2 space-y-1 rounded-2xl border border-zinc-200 bg-white p-2">
            {hits.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => {
                    setProductId(product.id);
                    setProductQuery(product.label);
                  }}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-left text-sm"
                >
                  {product.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <label htmlFor="issue-text" className="block text-sm font-medium text-zinc-700">
          Vad har hänt?
        </label>
        <textarea
          id="issue-text"
          name="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          maxLength={MAX_ISSUE_TEXT_LENGTH}
          placeholder="t.ex. Sex dosor krossade i kartongen från dagens leverans."
          className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base outline-none transition focus:border-zinc-400"
        />
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="text-sm text-zinc-500">{NO_PERSONAL_DATA_SHORT}</p>
          <span className="shrink-0 text-xs text-zinc-400">
            {text.length}/{MAX_ISSUE_TEXT_LENGTH}
          </span>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !text.trim()}
        className="h-14 w-full rounded-2xl bg-zinc-900 px-6 text-lg font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-400"
      >
        {pending ? "Skickar…" : "Skicka rapport"}
      </button>
    </form>
  );
}
