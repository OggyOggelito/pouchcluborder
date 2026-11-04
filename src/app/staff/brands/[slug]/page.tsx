import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "@/components/Markdown";
import { categoryLabel } from "@/lib/categories";
import { getBrandBySlugIncludingDrafts, getBrandFacts, hasContent } from "@/lib/repositories/brands";
import { listActiveProductsForBrand } from "@/lib/repositories/products";
import { canEditRoutines } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";
import { strengthUnitLabel, strengthUnitNote } from "@/lib/strength-units";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrandBySlugIncludingDrafts(slug);
  if (!brand) return { title: "Varumärke — Pouch Club" };
  return {
    title: `${brand.name} — Pouch Club`,
    description: brand.shortDescription ?? `Om ${brand.name}.`,
  };
}

function mg(value: number): string {
  return value.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}

function LongSection({ heading, markdown }: { heading: string; markdown: string | null }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{heading}</h2>
      {markdown ? (
        <div className="mt-3">
          <Markdown>{markdown}</Markdown>
        </div>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
          Innehåll kommer snart.
        </p>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrandBySlugIncludingDrafts(slug);

  if (!brand) notFound();

  // A draft is readable by whoever may edit brand content, so supplier text
  // can be reviewed before it goes live. For everyone else it does not exist.
  const user = await getSessionUser();
  const maySeeDraft = user ? canEditRoutines(user.role) : false;
  if (!brand.published && !maySeeDraft) notFound();

  const [products, facts] = await Promise.all([
    listActiveProductsForBrand(brand.id),
    getBrandFacts(brand.id),
  ]);

  // Flavor -> variants, so the stock list reads as prose rather than a table.
  const byFlavor = new Map<
    string,
    { strength: string; format: string; nicotineMgPerPortion: number | null }[]
  >();
  // Supplier flavour text is the same across a flavour's strengths, so it is
  // shown once under the flavour rather than repeated per variant.
  const descriptionByFlavor = new Map<string, string>();

  for (const product of products) {
    if (product.description && !descriptionByFlavor.has(product.flavor)) {
      descriptionByFlavor.set(product.flavor, product.description);
    }
    const variants = byFlavor.get(product.flavor) ?? [];
    variants.push({
      strength: product.strength,
      format: product.format,
      nicotineMgPerPortion: product.nicotineMgPerPortion,
    });
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

      {!brand.published ? (
        <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Utkast.</strong> Sidan är inte publicerad och syns bara för
          administratörer. Läs igenom den och publicera i{" "}
          <Link href={`/admin/brands/${brand.id}`} className="underline underline-offset-4">
            varumärkesredigeraren
          </Link>
          .
        </p>
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
          {/* Markdown, not plain text: most brands put a single paragraph
              here and render identically either way, but a supplier that
              gives us a list — Loop's awards — needs it to render as one. */}
          {brand.shortDescription ? (
            <div className="text-[17px]">
              <Markdown>{brand.shortDescription}</Markdown>
            </div>
          ) : null}

          {/* A missing long-form section is shown rather than omitted. Dropping
              it silently leaves staff unable to tell "we have no information"
              from "someone forgot to write it" — which matters for XQS, where
              none of the supplier material describes manufacturing. */}
          <LongSection heading="Så tillverkas de" markdown={brand.manufacturingProcess} />
          <LongSection heading="Blandning och dosering" markdown={brand.blendingNotes} />
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

      {facts.manufacturers.length > 0 || facts.strengthRange || facts.formats.length > 0 ? (
        <section className="mt-10 border-t border-zinc-200 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Snabbfakta
          </h2>
          <dl className="mt-3 space-y-2 text-[17px]">
            {facts.manufacturers.length > 0 ? (
              <Fact label="Tillverkare" value={facts.manufacturers.join(", ")} />
            ) : null}
            {facts.strengthRange ? (
              <Fact
                label="Nikotin per portion"
                value={
                  facts.strengthRange.min === facts.strengthRange.max
                    ? `${mg(facts.strengthRange.min)} mg/påse`
                    : `${mg(facts.strengthRange.min)}–${mg(facts.strengthRange.max)} mg/påse`
                }
              />
            ) : null}
            {/* The supplier's own unit, which is not always ours. Loop quotes
                mg per gram and this figure is per påse, so printing both
                without saying which is which invites staff to read 25 mg/g
                and 14,8 mg/påse as a contradiction. */}
            {strengthUnitLabel(brand.strengthUnit) ? (
              <Fact
                label="Leverantörens enhet"
                value={strengthUnitLabel(brand.strengthUnit) as string}
              />
            ) : null}
            {facts.formats.length > 0 ? (
              <Fact label="Format" value={facts.formats.join(", ")} />
            ) : null}
            {facts.portionsPerCan.length > 0 ? (
              <Fact
                label="Portioner per dosa"
                value={facts.portionsPerCan.sort((a, b) => a - b).join(" / ")}
              />
            ) : null}
          </dl>
          {strengthUnitNote(brand.strengthUnit) ? (
            <p className="mt-3 text-sm text-zinc-600">{strengthUnitNote(brand.strengthUnit)}</p>
          ) : null}
          {facts.sources.length > 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
              Nikotinvärden för {facts.enrichedCount} av {facts.variantCount} varianter hämtade
              från {facts.sources.join(", ")}.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-10 border-t border-zinc-200 pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Det här har vi i sortimentet
        </h2>

        {products.length === 0 ? (
          <p className="mt-3 text-zinc-500">Inget aktivt i katalogen just nu.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-500">
              {products.length} {products.length === 1 ? "variant" : "varianter"}
            </p>
            <ul className="mt-4 space-y-3">
              {[...byFlavor.entries()].map(([flavor, variants]) => (
                <li key={flavor}>
                  <p className="font-medium">{flavor}</p>
                  {descriptionByFlavor.has(flavor) ? (
                    <p className="mt-0.5 text-[15px] leading-relaxed text-zinc-600">
                      {descriptionByFlavor.get(flavor)}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {variants
                      .map((variant) => {
                        const strength =
                          variant.strength ||
                          (variant.nicotineMgPerPortion !== null
                            ? `~${variant.nicotineMgPerPortion.toLocaleString("sv-SE", {
                                maximumFractionDigits: 2,
                              })} mg`
                            : "");
                        return strength ? `${strength} · ${variant.format}` : variant.format;
                      })
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
