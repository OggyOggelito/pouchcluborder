import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "@/components/Markdown";
import { categoryLabel } from "@/lib/categories";
import { getPublishedBrandBySlug, hasContent } from "@/lib/repositories/brands";
import { listActiveProductsForBrand } from "@/lib/repositories/products";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getPublishedBrandBySlug(slug);
  if (!brand) return { title: "Varumärke — Pouch Club" };
  return {
    title: `${brand.name} — Pouch Club`,
    description: brand.shortDescription ?? `Om ${brand.name}.`,
  };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getPublishedBrandBySlug(slug);

  if (!brand) notFound();

  const products = await listActiveProductsForBrand(brand.id);

  // Flavor -> variants, so the stock list reads as prose rather than a table.
  const byFlavor = new Map<string, { strength: string; format: string }[]>();
  for (const product of products) {
    const variants = byFlavor.get(product.flavor) ?? [];
    variants.push({ strength: product.strength, format: product.format });
    byFlavor.set(product.flavor, variants);
  }

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-4">
      <Link
        href="/staff"
        className="inline-flex h-9 items-center text-sm text-zinc-500 underline underline-offset-4 transition hover:text-zinc-900"
      >
        ← Alla varumärken
      </Link>

      {brand.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- content URLs are
        // arbitrary and next/image would need every host allow-listed.
        <img
          src={brand.heroImageUrl}
          alt=""
          className="mt-4 aspect-[16/9] w-full rounded-2xl object-cover"
        />
      ) : null}

      <header className="mt-5 flex items-start gap-4">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl border border-zinc-200 object-contain p-1"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">{brand.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
            {categories.map((category) => (
              <span key={category} className="rounded-full bg-zinc-100 px-2 py-0.5">
                {categoryLabel(category)}
              </span>
            ))}
            {brand.countryOfOrigin ? <span>{brand.countryOfOrigin}</span> : null}
          </p>
        </div>
      </header>

      {!hasContent(brand) ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Innehåll kommer snart.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {brand.shortDescription ? (
            <p className="text-lg leading-relaxed text-zinc-700">{brand.shortDescription}</p>
          ) : null}

          {brand.manufacturingProcess ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Så tillverkas de
              </h2>
              <div className="mt-3">
                <Markdown>{brand.manufacturingProcess}</Markdown>
              </div>
            </section>
          ) : null}

          {brand.blendingNotes ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Blandning och dosering
              </h2>
              <div className="mt-3">
                <Markdown>{brand.blendingNotes}</Markdown>
              </div>
            </section>
          ) : null}
        </div>
      )}

      {brand.websiteUrl ? (
        <p className="mt-8">
          <a
            href={brand.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-4"
          >
            {brand.name}s webbplats ↗
          </a>
        </p>
      ) : null}

      <section className="mt-10 border-t border-zinc-200 pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Det här har vi i sortimentet
        </h2>

        {products.length === 0 ? (
          <p className="mt-3 text-zinc-500">Inget aktivt i katalogen just nu.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-400">
              {products.length} {products.length === 1 ? "variant" : "varianter"}
            </p>
            <ul className="mt-4 space-y-3">
              {[...byFlavor.entries()].map(([flavor, variants]) => (
                <li key={flavor}>
                  <p className="font-medium">{flavor}</p>
                  <p className="text-sm text-zinc-500">
                    {variants
                      .map((variant) =>
                        variant.strength
                          ? `${variant.strength} · ${variant.format}`
                          : variant.format
                      )
                      .join(" — ")}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
