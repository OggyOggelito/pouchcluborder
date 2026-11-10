"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { fold } from "@/lib/grouping";
import type { BrandSummary } from "@/lib/repositories/brands";

/**
 * A brand appears under every category it actually stocks, so a brand that
 * sells both pouches and tobacco snus (Lundgrens, Skruf, Loop, Velo, Lewa) is
 * findable under either heading rather than only its biggest one.
 */
export default function BrandDirectory({ brands }: { brands: BrandSummary[] }) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const tokens = fold(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return brands;
    return brands.filter((brand) => {
      const haystack = fold(`${brand.name} ${brand.shortDescription ?? ""}`);
      return tokens.every((token) => haystack.includes(token));
    });
  }, [brands, query]);

  const sections = useMemo(() => {
    const known = CATEGORIES.map((category) => ({
      category: category as string,
      brands: matches.filter((brand) => brand.categories.includes(category)),
    }));

    // Brands whose products carry no category, plus any deactivated-only brand.
    const uncategorised = matches.filter((brand) => brand.categories.length === 0);
    if (uncategorised.length > 0) {
      known.push({ category: "", brands: uncategorised });
    }

    return known.filter((section) => section.brands.length > 0);
  }, [matches]);

  return (
    <>
      <div className="sticky top-[57px] z-20 -mx-4 bg-canvas/95 px-4 pb-3 pt-3 backdrop-blur">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök varumärke…"
          aria-label="Sök varumärke"
          className="h-12 w-full rounded-2xl border border-control bg-raised px-4 text-base text-ink placeholder:text-muted outline-none transition focus:border-primary [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>

      {sections.length === 0 ? (
        <p className="mt-10 text-center text-muted">
          Inga varumärken matchar {query ? <strong>”{query}”</strong> : "sökningen"}.
        </p>
      ) : (
        <div className="mt-2 space-y-8">
          {sections.map((section) => (
            <section key={section.category || "other"}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {section.category ? categoryLabel(section.category) : "Övrigt"}
              </h2>
              <ul className="mt-3 space-y-2">
                {section.brands.map((brand) => (
                  <li key={`${section.category}-${brand.id}`}>
                    <Link
                      href={`/staff/brands/${brand.slug}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-4 shadow-sm transition active:scale-[0.99] hover:border-control"
                    >
                      <span className="min-w-0">
                        <span className="block text-lg font-medium tracking-tight">
                          {brand.name}
                        </span>
                        {brand.shortDescription ? (
                          <span className="mt-0.5 line-clamp-2 block text-sm text-muted">
                            {brand.shortDescription}
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-sm text-muted">
                            Innehåll kommer snart
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm text-muted tabular-nums">
                        {brand.productCountByCategory[section.category] ?? brand.productCount}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
