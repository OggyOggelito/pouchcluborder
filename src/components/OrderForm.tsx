"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QuantityInput from "@/components/QuantityInput";
import { formatNumber, formatSek } from "@/lib/format";
import { brandVariants, filterCatalog, groupCatalog } from "@/lib/grouping";
import { categoryLabel } from "@/lib/categories";
import type { CatalogProduct } from "@/lib/repositories/products";
import type { StoreSummary } from "@/lib/repositories/stores";
import { forgetStore } from "@/lib/store-selection";

/** 4.4 -> "4,4", 9 -> "9" — Swedish decimal comma, no trailing zeroes. */
function formatMg(value: number): string {
  return value.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}

type Quantities = Record<string, number>;

type Submitted = { id: string; totalQuantity: number; totalSek: number };

export default function OrderForm({
  store,
  products,
  canSwitchStore = false,
}: {
  store: StoreSummary;
  products: CatalogProduct[];
  /** False when the account only reaches one store — switching would dead-end. */
  canSwitchStore?: boolean;
}) {
  const router = useRouter();
  const draftKey = `pc_draft_${store.id}`;

  const [quantities, setQuantities] = useState<Quantities>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [openBrands, setOpenBrands] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const draftLoaded = useRef(false);

  // Categories present in the catalog, in catalog order, for the filter chips.
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const product of products) if (product.category) seen.add(product.category);
    return [...seen];
  }, [products]);

  const groups = useMemo(
    () => groupCatalog(category ? products.filter((p) => p.category === category) : products),
    [products, category]
  );
  const visibleGroups = useMemo(() => filterCatalog(groups, query), [groups, query]);
  const priceById = useMemo(
    () => new Map(products.map((product) => [product.id, product.pricePerStock])),
    [products]
  );

  // Restore an unsent draft (accidental reload, phone locking, tab eviction).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Quantities;
        const valid: Quantities = {};
        for (const [productId, quantity] of Object.entries(parsed)) {
          if (priceById.has(productId) && Number.isInteger(quantity) && quantity > 0) {
            valid[productId] = quantity;
          }
        }
        if (Object.keys(valid).length > 0) setQuantities(valid);
      }
    } catch {
      // Corrupt or unavailable storage — start from an empty order.
    }
    draftLoaded.current = true;
  }, [draftKey, priceById]);

  useEffect(() => {
    if (!draftLoaded.current) return;
    try {
      if (Object.keys(quantities).length === 0) window.localStorage.removeItem(draftKey);
      else window.localStorage.setItem(draftKey, JSON.stringify(quantities));
    } catch {
      // Draft persistence is a convenience, never a blocker.
    }
  }, [draftKey, quantities]);

  const totals = useMemo(() => {
    let totalQuantity = 0;
    let totalSek = 0;
    for (const [productId, quantity] of Object.entries(quantities)) {
      if (quantity <= 0) continue;
      totalQuantity += quantity;
      totalSek += quantity * (priceById.get(productId) ?? 0);
    }
    return { totalQuantity, totalSek: Math.round(totalSek * 100) / 100 };
  }, [quantities, priceById]);

  const setQuantity = useCallback((productId: string, next: number) => {
    setQuantities((current) => {
      if (next <= 0) {
        if (!(productId in current)) return current;
        const { [productId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [productId]: next };
    });
  }, []);

  const quantityInBrand = useCallback(
    (brand: string) => {
      const group = groups.find((candidate) => candidate.brand === brand);
      if (!group) return 0;
      return brandVariants(group).reduce((sum, variant) => sum + (quantities[variant.id] ?? 0), 0);
    },
    [groups, quantities]
  );

  function toggleBrand(brand: string) {
    setOpenBrands((current) => {
      const next = new Set(current);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  }

  function changeStore() {
    forgetStore();
    router.refresh();
  }

  async function submitOrder() {
    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          note: note.trim() || null,
          lines: Object.entries(quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([productId, quantity]) => ({ productId, quantity })),
        }),
      });

      const payload = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "Kunde inte spara beställningen.");
      }

      setSubmitted({ id: payload.id, ...totals });
      setQuantities({});
      setNote("");
      setQuery("");
      setCategory(null);
      window.scrollTo({ top: 0 });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Något gick fel.");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <OrderConfirmation
        submitted={submitted}
        storeName={store.name}
        onNewOrder={() => setSubmitted(null)}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-40 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{store.name}</h1>
        {canSwitchStore ? (
          <button
            type="button"
            onClick={changeStore}
            className="text-sm text-zinc-500 underline underline-offset-4 transition hover:text-zinc-900"
          >
            Byt butik
          </button>
        ) : null}
      </div>

      <div className="sticky top-[57px] z-20 -mx-4 bg-zinc-50/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök märke eller smak…"
            aria-label="Sök märke eller smak"
            className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-4 pr-10 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Rensa sökning"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            >
              ✕
            </button>
          ) : null}
        </div>

        {categories.length > 1 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <CategoryChip active={category === null} onClick={() => setCategory(null)}>
              Alla
            </CategoryChip>
            {categories.map((name) => (
              <CategoryChip
                key={name}
                active={category === name}
                onClick={() => setCategory(category === name ? null : name)}
              >
                {categoryLabel(name)}
              </CategoryChip>
            ))}
          </div>
        ) : null}
      </div>

      {visibleGroups.length === 0 ? (
        <p className="mt-10 text-center text-zinc-500">
          Inga produkter matchar <span className="font-medium text-zinc-700">”{query}”</span>.
        </p>
      ) : null}

      <ul className="mt-1 space-y-2">
        {visibleGroups.map((group) => {
          const brandQuantity = quantityInBrand(group.brand);
          const expanded = query.trim().length > 0 || openBrands.has(group.brand);

          return (
            <li
              key={group.brand}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleBrand(group.brand)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-zinc-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-base font-semibold">{group.brand}</span>
                  {group.categories.length === 1 && group.categories[0].category ? (
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {categoryLabel(group.categories[0].category)}
                    </span>
                  ) : null}
                  {brandQuantity > 0 ? (
                    <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {brandQuantity}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-sm text-zinc-400">
                  <span>{group.variantCount}</span>
                  <span
                    aria-hidden
                    className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                  >
                    ›
                  </span>
                </span>
              </button>

              {expanded ? (
                <div className="border-t border-zinc-100">
                  {group.categories.map((categoryGroup) => (
                    <div key={categoryGroup.key}>
                      {group.categories.length > 1 && categoryGroup.category ? (
                        <p className="bg-zinc-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          {categoryLabel(categoryGroup.category)}
                        </p>
                      ) : null}

                      {categoryGroup.flavors.map((flavorGroup) => (
                        <div
                          key={flavorGroup.key}
                          className="border-b border-zinc-100 last:border-b-0"
                        >
                          <p className="px-4 pt-3 text-sm font-medium text-zinc-500">
                            {flavorGroup.flavor}
                          </p>
                          <ul>
                            {flavorGroup.variants.map((variant) => (
                              <li
                                key={variant.id}
                                className="flex items-center justify-between gap-3 px-4 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-[15px]">
                                    {variant.strength ? (
                                      <>
                                        <span className="font-medium">{variant.strength}</span>
                                        <span className="text-zinc-400"> · </span>
                                      </>
                                    ) : variant.nicotineMgPerPortion !== null ? (
                                      <>
                                        {/* Not from the masterdoc — matched in by
                                            EAN — so it is marked rather than shown
                                            as if the supplier had stated it. */}
                                        <span
                                          className="font-medium text-zinc-500"
                                          title="Nikotinhalt från snusbolaget.se, matchad på EAN"
                                        >
                                          ~{formatMg(variant.nicotineMgPerPortion)} mg
                                        </span>
                                        <span className="text-zinc-400"> · </span>
                                      </>
                                    ) : null}
                                    <span
                                      className={
                                        variant.strength || variant.nicotineMgPerPortion !== null
                                          ? "text-zinc-600"
                                          : "font-medium"
                                      }
                                    >
                                      {variant.format}
                                    </span>
                                    {!variant.strength && variant.nicotineMgPerPortion === null ? (
                                      <span className="text-zinc-400"> · styrka saknas</span>
                                    ) : null}
                                  </p>
                                  <p className="text-sm text-zinc-400">
                                    {variant.pricePerStock > 0
                                      ? `${formatSek(variant.pricePerStock)} / stock`
                                      : "Pris saknas"}
                                  </p>
                                </div>
                                <QuantityInput
                                  value={quantities[variant.id] ?? 0}
                                  onChange={(next) => setQuantity(variant.id, next)}
                                  label={`${group.brand} ${flavorGroup.flavor} ${variant.strength} ${variant.format}`}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <label htmlFor="note" className="block text-sm font-medium text-zinc-600">
          Meddelande till lagret (valfritt)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="T.ex. ”brådskande, slut i hyllan”"
          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white p-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <SummaryBar
        totalQuantity={totals.totalQuantity}
        totalSek={totals.totalSek}
        saving={saving}
        error={error}
        onSubmit={submitOrder}
      />
    </main>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryBar({
  totalQuantity,
  totalSek,
  saving,
  error,
  onSubmit,
}: {
  totalQuantity: number;
  totalSek: number;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {error ? (
          <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold tabular-nums">
              {formatNumber(totalQuantity)}{" "}
              <span className="text-sm font-normal text-zinc-500">
                {totalQuantity === 1 ? "stock" : "stockar"}
              </span>
            </p>
            <p className="truncate text-sm text-zinc-500 tabular-nums">{formatSek(totalSek)}</p>
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={totalQuantity === 0 || saving}
            className="h-12 shrink-0 rounded-2xl bg-brand-600 px-6 text-base font-semibold text-white transition active:scale-[0.98] disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {saving ? "Skickar…" : "Skicka beställning"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderConfirmation({
  submitted,
  storeName,
  onNewOrder,
}: {
  submitted: Submitted;
  storeName: string;
  onNewOrder: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-2xl text-brand-700">
          ✓
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Beställningen är skickad</h1>
        <p className="mt-1 text-zinc-600">
          {storeName} · {formatNumber(submitted.totalQuantity)} stockar ·{" "}
          {formatSek(submitted.totalSek)}
        </p>

        <a
          href={`/api/orders/${submitted.id}/export`}
          className="mt-6 flex h-12 items-center justify-center rounded-2xl bg-zinc-900 px-6 text-base font-semibold text-white transition active:scale-[0.98]"
        >
          Exportera till Excel
        </a>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onNewOrder}
            className="h-12 flex-1 rounded-2xl border border-zinc-200 px-4 font-medium transition hover:bg-zinc-50"
          >
            Ny beställning
          </button>
          <Link
            href="/orders"
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-zinc-200 px-4 font-medium transition hover:bg-zinc-50"
          >
            Tidigare beställningar
          </Link>
        </div>
      </div>
    </main>
  );
}
