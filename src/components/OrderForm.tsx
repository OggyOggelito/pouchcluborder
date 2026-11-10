"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QuantityInput from "@/components/QuantityInput";
import TermHint from "@/components/ui/TermHint";
import Toast from "@/components/ui/Toast";
import { formatNumber, formatSek } from "@/lib/format";
import { brandVariants, filterCatalog, groupCatalog } from "@/lib/grouping";
import { categoryLabel } from "@/lib/categories";
import { saveDraftAction } from "@/lib/draft-actions";
import { pruneToCatalog, type DraftLines } from "@/lib/order-drafts";
import { countOf, termFor } from "@/lib/terms";
import type { CatalogProduct } from "@/lib/repositories/products";
import type { StoreSummary } from "@/lib/repositories/stores";
import { forgetStore } from "@/lib/store-selection";

/** 4.4 -> "4,4", 9 -> "9" — Swedish decimal comma, no trailing zeroes. */
function formatMg(value: number): string {
  return value.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}

type Submitted = { id: string; totalQuantity: number; totalSek: number };

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "retrying" }
  | { kind: "conflict" };

/** A second after the last change, as the brief asks. */
const AUTOSAVE_DELAY_MS = 1000;
const RETRY_DELAY_MS = 5000;

export default function OrderForm({
  store,
  products,
  canSwitchStore = false,
  initialDraft,
}: {
  store: StoreSummary;
  products: CatalogProduct[];
  /** False when the account only reaches one store — switching would dead-end. */
  canSwitchStore?: boolean;
  /** The server-side draft for this user and store, if there is one. */
  initialDraft: { lines: DraftLines; note: string; version: number } | null;
}) {
  const router = useRouter();
  const localKey = `pc_draft_${store.id}`;
  const categoryKey = "pc.lastCategory";

  const [quantities, setQuantities] = useState<DraftLines>(() => initialDraft?.lines ?? {});
  const [note, setNote] = useState(() => initialDraft?.note ?? "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [openBrands, setOpenBrands] = useState<Set<string>>(() => new Set());
  const [onlySelected, setOnlySelected] = useState(false);
  const [step, setStep] = useState<"pick" | "review">("pick");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [toast, setToast] = useState<string | null>(null);

  const version = useRef(initialDraft?.version ?? 0);
  const hydrated = useRef(false);

  const priceById = useMemo(
    () => new Map(products.map((product) => [product.id, product.pricePerStock])),
    [products]
  );

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const product of products) if (product.category) seen.add(product.category);
    return [...seen];
  }, [products]);

  // ---------------------------------------------------------------------
  // Draft: server first, local storage as the safety net
  // ---------------------------------------------------------------------

  /**
   * On first mount, take whatever the local copy holds if the server had
   * nothing. That is the "the save failed and then the phone locked" case:
   * the lines never reached the server, so the server draft is empty and the
   * local one is the only record of the work.
   */
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    if (initialDraft && Object.keys(initialDraft.lines).length > 0) return;

    try {
      const raw = window.localStorage.getItem(localKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      const { lines, dropped } = pruneToCatalog(
        parsed as DraftLines,
        products.map((product) => product.id)
      );
      if (Object.keys(lines).length === 0) return;

      setQuantities(lines);
      setToast(
        dropped > 0
          ? `Återställde din påbörjade beställning. ${dropped} rad(er) finns inte kvar i katalogen.`
          : "Återställde din påbörjade beställning."
      );
    } catch {
      // Corrupt or blocked storage — start from an empty order.
    }
  }, [initialDraft, localKey, products]);

  // The local copy is written on every change, synchronously, so it is there
  // even if the tab dies before the debounced server save fires.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      if (Object.keys(quantities).length === 0) window.localStorage.removeItem(localKey);
      else window.localStorage.setItem(localKey, JSON.stringify(quantities));
    } catch {
      // A draft is a convenience and never a blocker.
    }
  }, [localKey, quantities]);

  // Last category, so the next order opens where the last one did.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(categoryKey);
      if (saved && categories.includes(saved)) setCategory(saved);
    } catch {
      // Ignore.
    }
    // Categories are derived from the catalog and stable for a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseCategory = useCallback((next: string | null) => {
    setCategory(next);
    try {
      if (next) window.localStorage.setItem(categoryKey, next);
      else window.localStorage.removeItem(categoryKey);
    } catch {
      // Ignore.
    }
  }, []);

  /** One autosave attempt. Shared by the debounce and the retry timer. */
  const persist = useCallback(
    async (lines: DraftLines, currentNote: string) => {
      setSaveState({ kind: "saving" });
      try {
        const result = await saveDraftAction({
          storeId: store.id,
          lines,
          note: currentNote,
          clientVersion: version.current,
        });

        if (result.kind === "saved") {
          version.current = result.version;
          setSaveState({ kind: "saved" });
          return;
        }
        if (result.kind === "conflict") {
          setSaveState({ kind: "conflict" });
          return;
        }
        setSaveState({ kind: "retrying" });
      } catch {
        // Offline, or the server is unreachable. The local copy still holds
        // the work; say so plainly and try again shortly.
        setSaveState({ kind: "retrying" });
      }
    },
    [store.id]
  );

  // Debounced autosave.
  useEffect(() => {
    if (!hydrated.current) return;
    if (saveState.kind === "conflict") return;

    const timer = setTimeout(() => {
      void persist(quantities, note);
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
    // saveState is deliberately not a dependency: it changes as a *result* of
    // saving, and depending on it would restart the timer on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantities, note, persist]);

  // Retry loop for a failed save.
  useEffect(() => {
    if (saveState.kind !== "retrying") return;
    const timer = setTimeout(() => {
      void persist(quantities, note);
    }, RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [saveState, persist, quantities, note]);

  // ---------------------------------------------------------------------
  // Derived catalog
  // ---------------------------------------------------------------------

  const selectedIds = useMemo(
    () => new Set(Object.keys(quantities).filter((id) => (quantities[id] ?? 0) > 0)),
    [quantities]
  );

  const groups = useMemo(() => {
    let scope = category ? products.filter((p) => p.category === category) : products;
    if (onlySelected) scope = scope.filter((product) => selectedIds.has(product.id));
    return groupCatalog(scope);
  }, [products, category, onlySelected, selectedIds]);

  const visibleGroups = useMemo(() => filterCatalog(groups, query), [groups, query]);

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

  /** The chosen lines, grouped by brand, for the review screen. */
  const chosen = useMemo(() => {
    const byBrand = new Map<string, CatalogProduct[]>();
    for (const product of products) {
      if (!selectedIds.has(product.id)) continue;
      const list = byBrand.get(product.brand) ?? [];
      list.push(product);
      byBrand.set(product.brand, list);
    }
    return [...byBrand.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "sv"))
      .map(([brand, items]) => ({ brand, items }));
  }, [products, selectedIds]);

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
      setOnlySelected(false);
      setStep("pick");
      version.current = 0;
      setSaveState({ kind: "idle" });
      try {
        window.localStorage.removeItem(localKey);
      } catch {
        // Ignore.
      }
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

  if (step === "review") {
    return (
      <ReviewStep
        chosen={chosen}
        quantities={quantities}
        note={note}
        onNote={setNote}
        onQuantity={setQuantity}
        totals={totals}
        storeName={store.name}
        saving={saving}
        error={error}
        onBack={() => setStep("pick")}
        onSubmit={submitOrder}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-44 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{store.name}</h1>
        {canSwitchStore ? (
          <button
            type="button"
            onClick={changeStore}
            className="min-h-11 text-sm text-muted underline underline-offset-4 transition hover:text-ink"
          >
            Byt butik
          </button>
        ) : null}
      </div>

      <DraftStatus state={saveState} onKeepMine={() => void persist(quantities, note)} />

      <div className="sticky top-[53px] z-20 -mx-4 bg-canvas/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök märke eller smak…"
            aria-label="Sök märke eller smak"
            className="h-12 w-full rounded-2xl border border-control bg-raised pl-4 pr-12 text-base text-ink placeholder:text-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-focus"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Rensa sökning"
              className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-raised"
            >
              <span aria-hidden>✕</span>
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {categories.length > 1 ? (
            <>
              <CategoryChip active={category === null} onClick={() => chooseCategory(null)}>
                Alla
              </CategoryChip>
              {categories.map((name) => (
                <CategoryChip
                  key={name}
                  active={category === name}
                  onClick={() => chooseCategory(category === name ? null : name)}
                >
                  {categoryLabel(name)}
                </CategoryChip>
              ))}
            </>
          ) : null}

          {selectedIds.size > 0 ? (
            <CategoryChip active={onlySelected} onClick={() => setOnlySelected((on) => !on)}>
              Visa bara valda ({selectedIds.size})
            </CategoryChip>
          ) : null}
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="mt-10 text-center text-muted">
          {onlySelected
            ? "Inget valt matchar sökningen."
            : query.trim()
              ? `Inga produkter matchar ”${query}”.`
              : "Inga produkter i katalogen."}
        </p>
      ) : null}

      <ul className="mt-1 space-y-2">
        {visibleGroups.map((group) => {
          const brandQuantity = quantityInBrand(group.brand);
          const expanded = query.trim().length > 0 || onlySelected || openBrands.has(group.brand);

          return (
            <li
              key={group.brand}
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleBrand(group.brand)}
                aria-expanded={expanded}
                className="flex min-h-tap w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-raised"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-base font-semibold">{group.brand}</span>
                  {group.categories.length === 1 && group.categories[0].category ? (
                    <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-xs text-ink">
                      {categoryLabel(group.categories[0].category)}
                    </span>
                  ) : null}
                  {brandQuantity > 0 ? (
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                      {brandQuantity}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  <span>{group.variantCount}</span>
                  <span aria-hidden className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
                    ›
                  </span>
                </span>
              </button>

              {expanded ? (
                <div className="border-t border-line">
                  {group.categories.map((categoryGroup) => (
                    <div key={categoryGroup.key}>
                      {group.categories.length > 1 && categoryGroup.category ? (
                        <p className="bg-raised px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                          {categoryLabel(categoryGroup.category)}
                        </p>
                      ) : null}

                      {categoryGroup.flavors.map((flavorGroup) => (
                        <div key={flavorGroup.key} className="border-b border-line last:border-b-0">
                          <p className="px-4 pt-3 text-sm font-medium text-muted">
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
                                        <span className="text-muted"> · </span>
                                      </>
                                    ) : variant.nicotineMgPerPortion !== null ? (
                                      <>
                                        {/* Not from the masterdoc — matched in by
                                            EAN — so it is marked rather than shown
                                            as if the supplier had stated it. */}
                                        <span
                                          className="font-medium text-muted"
                                          title="Nikotinhalt från snusbolaget.se, matchad på EAN"
                                        >
                                          ~{formatMg(variant.nicotineMgPerPortion)} mg
                                        </span>
                                        <span className="text-muted"> · </span>
                                      </>
                                    ) : null}
                                    <span
                                      className={
                                        variant.strength || variant.nicotineMgPerPortion !== null
                                          ? "text-ink"
                                          : "font-medium"
                                      }
                                    >
                                      {variant.format}
                                    </span>
                                    {!variant.strength && variant.nicotineMgPerPortion === null ? (
                                      <span className="text-muted"> · styrka saknas</span>
                                    ) : null}
                                  </p>
                                  <p className="text-sm text-muted">
                                    {variant.pricePerStock > 0
                                      ? `${formatSek(variant.pricePerStock)} / ${termFor("stock", 1)}`
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

      <SummaryBar
        totalQuantity={totals.totalQuantity}
        totalSek={totals.totalSek}
        onReview={() => {
          setStep("review");
          window.scrollTo({ top: 0 });
        }}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}

/**
 * The autosave indicator.
 *
 * Silent while things are fine — a "Sparat" that never goes away is noise.
 * Loud only when a save is failing or a draft moved on somewhere else, which
 * are the two cases where someone could lose work.
 */
function DraftStatus({ state, onKeepMine }: { state: SaveState; onKeepMine: () => void }) {
  if (state.kind === "idle" || state.kind === "saving" || state.kind === "saved") return null;

  if (state.kind === "retrying") {
    return (
      <p
        role="status"
        className="mt-3 rounded-xl bg-raised px-3 py-2 text-sm text-warning"
      >
        Sparas inte just nu, försöker igen. Det du har lagt till finns kvar i telefonen.
      </p>
    );
  }

  return (
    <div role="alert" className="mt-3 rounded-xl bg-raised px-3 py-3 text-sm text-warning">
      <p className="font-medium">Beställningen har ändrats någon annanstans</p>
      <p className="mt-1">
        Samma utkast har redigerats på en annan enhet. Ladda om för att hämta den versionen, eller
        fortsätt med din och skriv över den.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-xl bg-warning px-4 text-sm font-semibold text-on-primary"
        >
          Hämta den senaste
        </button>
        <button
          type="button"
          onClick={onKeepMine}
          className="min-h-11 rounded-xl border border-warning px-4 text-sm font-medium"
        >
          Fortsätt med min
        </button>
      </div>
    </div>
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
      className={`min-h-tap shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition ${
        active
          ? "border-primary bg-raised font-semibold text-ink ring-1 ring-primary"
          : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** The one primary action on the picking screen: go and check it. */
function SummaryBar({
  totalQuantity,
  totalSek,
  onReview,
}: {
  totalQuantity: number;
  totalSek: number;
  onReview: () => void;
}) {
  const empty = totalQuantity === 0;

  return (
    <div className="fixed inset-x-0 bottom-[4.25rem] z-30 px-4 lg:bottom-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tabular-nums">
            {formatNumber(totalQuantity)} {termFor("stock", totalQuantity)}
            {totalQuantity === 0 ? <TermHint term="stock" /> : null}
          </p>
          <p className="truncate text-sm text-muted tabular-nums">
            {formatSek(totalSek)} inköpsvärde
          </p>
        </div>
        <button
          type="button"
          onClick={onReview}
          disabled={empty}
          className="h-12 shrink-0 rounded-2xl bg-primary px-6 text-base font-semibold text-on-primary transition active:scale-[0.98] disabled:bg-raised disabled:text-muted"
        >
          Granska
        </button>
      </div>
    </div>
  );
}

/**
 * "Granska" — everything chosen, grouped by brand, editable in place.
 *
 * A separate screen rather than a modal, so the list can be as long as it
 * needs to be and the back button behaves. One primary action.
 */
function ReviewStep({
  chosen,
  quantities,
  note,
  onNote,
  onQuantity,
  totals,
  storeName,
  saving,
  error,
  onBack,
  onSubmit,
}: {
  chosen: { brand: string; items: CatalogProduct[] }[];
  quantities: DraftLines;
  note: string;
  onNote: (value: string) => void;
  onQuantity: (productId: string, next: number) => void;
  totals: { totalQuantity: number; totalSek: number };
  storeName: string;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const empty = chosen.length === 0;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-44 pt-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <span aria-hidden>‹</span> Tillbaka till sortimentet
      </button>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Granska beställningen</h1>
      <p className="mt-1 text-muted">
        {storeName} · {countOf("stock", totals.totalQuantity)}
      </p>

      {empty ? (
        <p className="mt-8 rounded-2xl border border-dashed border-control p-6 text-center text-muted">
          Du har inte valt något än.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {chosen.map((group) => (
            <li
              key={group.brand}
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
            >
              <p className="border-b border-line px-4 py-3 font-semibold">{group.brand}</p>
              <ul>
                {group.items.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px]">{product.flavor}</p>
                      <p className="truncate text-sm text-muted">
                        {[product.strength, product.format].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <QuantityInput
                      value={quantities[product.id] ?? 0}
                      onChange={(next) => onQuantity(product.id, next)}
                      label={`${product.brand} ${product.flavor} ${product.strength} ${product.format}`}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <label htmlFor="note" className="block text-sm font-medium text-ink">
          Meddelande till lagret (valfritt)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(event) => onNote(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="T.ex. ”brådskande, slut i hyllan”"
          className="mt-2 w-full rounded-2xl border border-control bg-raised p-3 text-base text-ink placeholder:text-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-focus"
        />
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-raised p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-[4.25rem] z-30 px-4 lg:bottom-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tabular-nums">
              {formatNumber(totals.totalQuantity)} {termFor("stock", totals.totalQuantity)}
            </p>
            <p className="truncate text-sm text-muted tabular-nums">
              {formatSek(totals.totalSek)} inköpsvärde
            </p>
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || empty}
            className="h-12 shrink-0 rounded-2xl bg-primary px-6 text-base font-semibold text-on-primary transition active:scale-[0.98] disabled:bg-raised disabled:text-muted"
          >
            {saving ? "Skickar…" : "Skicka beställning"}
          </button>
        </div>
      </div>
    </main>
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-3xl border border-line bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-raised text-2xl text-primary">
          ✓
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Beställningen är skickad</h1>
        <p className="mt-1 text-ink">
          {storeName} · {countOf("stock", submitted.totalQuantity)} ·{" "}
          {formatSek(submitted.totalSek)}
        </p>

        <a
          href={`/api/orders/${submitted.id}/export`}
          className="mt-6 flex min-h-12 items-center justify-center rounded-2xl bg-primary px-6 text-base font-semibold text-on-primary transition active:scale-[0.98]"
        >
          Exportera Excel
        </a>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/orders/${submitted.id}`}
            className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-control px-4 font-medium transition hover:bg-raised"
          >
            Se beställningen
          </Link>
          <button
            type="button"
            onClick={onNewOrder}
            className="min-h-12 flex-1 rounded-2xl border border-control px-4 font-medium transition hover:bg-raised"
          >
            Ny beställning
          </button>
        </div>
      </div>
    </main>
  );
}
