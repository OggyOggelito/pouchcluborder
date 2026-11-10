"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { FLAVOR_GROUPS, FLAVOR_GROUP_LABELS, parseTags, type FlavorGroup } from "@/lib/flavor-tags";
import { fold } from "@/lib/grouping";
import type { FinderProduct } from "@/lib/repositories/products";
import { STRENGTH_RANGES, formatMg, matchesRange, strengthMg, type StrengthRangeId } from "@/lib/strength";

type Facet = { id: string; label: string };

/**
 * Staff-facing product lookup. Filters are applied in the browser over the
 * whole active catalog — about 1100 rows — so a tap responds immediately on a
 * phone behind the counter.
 *
 * No stock or availability anywhere: we have no live stock data, and implying
 * it would have staff promising things the shelf cannot back up.
 */
export default function ProductFinder({ products }: { products: FinderProduct[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [range, setRange] = useState<StrengthRangeId | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [group, setGroup] = useState<FlavorGroup | null>(null);

  const formats: Facet[] = useMemo(() => {
    const seen = new Map<string, number>();
    for (const product of products) {
      if (product.format) seen.set(product.format, (seen.get(product.format) ?? 0) + 1);
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({ id, label: id }));
  }, [products]);

  const categories: Facet[] = useMemo(() => {
    const present = new Set(products.map((product) => product.category).filter(Boolean) as string[]);
    return CATEGORIES.filter((name) => present.has(name)).map((name) => ({
      id: name,
      label: categoryLabel(name),
    }));
  }, [products]);

  const results = useMemo(() => {
    const tokens = fold(query).split(/\s+/).filter(Boolean);

    const matched = products.filter((product) => {
      if (category && product.category !== category) return false;
      if (format && product.format !== format) return false;
      if (range && !matchesRange(strengthMg(product), range)) return false;
      if (group && !parseTags(product.flavorTags).includes(group)) return false;

      if (tokens.length > 0) {
        const haystack = fold(
          `${product.brand} ${product.flavor} ${product.strength} ${product.format} ${product.description ?? ""}`
        );
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });

    // Brand, then milligrams ascending. Unknown strengths sort last within a
    // brand rather than pretending to be zero.
    return matched.sort((a, b) => {
      const byBrand = a.brand.localeCompare(b.brand, "sv");
      if (byBrand !== 0) return byBrand;
      const mgA = strengthMg(a);
      const mgB = strengthMg(b);
      if (mgA === null && mgB === null) return a.flavor.localeCompare(b.flavor, "sv");
      if (mgA === null) return 1;
      if (mgB === null) return -1;
      return mgA - mgB || a.flavor.localeCompare(b.flavor, "sv");
    });
  }, [products, query, category, format, range, group]);

  const hasFilter = Boolean(query || category || format || range || group);

  return (
    <>
      <div className="sticky top-[57px] z-20 -mx-4 space-y-3 bg-canvas/95 px-4 pb-3 pt-3 backdrop-blur">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök märke, smak eller format…"
          aria-label="Sök produkt"
          className="h-12 w-full rounded-2xl border border-control bg-raised px-4 text-base text-ink placeholder:text-muted outline-none transition focus:border-primary [&::-webkit-search-cancel-button]:appearance-none"
        />

        <FilterRow label="Kategori" options={categories} value={category} onChange={setCategory} />
        <FilterRow
          label="Styrka"
          options={STRENGTH_RANGES.map((item) => ({ id: item.id, label: item.label }))}
          value={range}
          onChange={(next) => setRange(next as StrengthRangeId | null)}
        />
        <FilterRow label="Format" options={formats} value={format} onChange={setFormat} />
        <FilterRow
          label="Smakgrupp"
          options={FLAVOR_GROUPS.map((name) => ({ id: name, label: FLAVOR_GROUP_LABELS[name] }))}
          value={group}
          onChange={(next) => setGroup(next as FlavorGroup | null)}
        />
      </div>

      <p className="mt-2 text-sm text-muted" role="status">
        {results.length} {results.length === 1 ? "produkt" : "produkter"}
        {hasFilter ? " matchar" : " i sortimentet"}.
      </p>

      {results.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-control p-6 text-center">
          <p className="text-muted">Inga produkter matchar filtren.</p>
          {/* The most useful moment to capture demand: someone looked and we
              did not have it. The search text comes along prefilled. */}
          <Link
            href={`/requests/new${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`}
            className="mt-4 inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-on-primary"
          >
            Hittar du inte? Logga som kundönskemål
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {results.map((product) => {
            const mg = strengthMg(product);
            return (
              <li
                key={product.id}
                className="rounded-2xl border border-line bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-semibold tracking-tight">
                    {product.brand} <span className="font-normal text-muted">{product.flavor}</span>
                  </p>
                  <p className="text-sm tabular-nums text-muted">
                    {mg !== null ? `${formatMg(mg)} mg` : "mg okänt"}
                    <span className="text-muted"> · </span>
                    {product.format}
                  </p>
                </div>

                {/* The brand's own strength wording, when the data carries it,
                    instead of a label of our own. */}
                {product.strength && product.strength !== `${mg}mg` ? (
                  <p className="mt-0.5 text-sm text-muted">
                    Märkets benämning: <span className="font-medium">{product.strength}</span>
                  </p>
                ) : null}

                {product.description ? (
                  <p className="mt-2 text-[15px] leading-relaxed text-ink">
                    {product.description}
                  </p>
                ) : null}

                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  {product.category ? <span>{categoryLabel(product.category)}</span> : null}
                  {parseTags(product.flavorTags).map((tag) => (
                    <span key={tag} className="rounded-full bg-raised px-2 py-0.5 text-muted">
                      {FLAVOR_GROUP_LABELS[tag]}
                    </span>
                  ))}
                  {product.brandSlug ? (
                    <Link
                      href={`/staff/brands/${product.brandSlug}`}
                      className="underline underline-offset-4 hover:text-ink"
                    >
                      Om {product.brand}
                    </Link>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Facet[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
        <Chip active={value === null} onClick={() => onChange(null)}>
          Alla
        </Chip>
        {options.map((option) => (
          <Chip
            key={option.id}
            active={value === option.id}
            onClick={() => onChange(value === option.id ? null : option.id)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
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
          : "border-control bg-surface text-muted hover:border-control"
      }`}
    >
      {children}
    </button>
  );
}
