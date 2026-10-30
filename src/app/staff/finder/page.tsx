import Link from "next/link";
import type { Metadata } from "next";
import ProductFinder from "@/components/ProductFinder";
import { listProductsForFinder } from "@/lib/repositories/products";

export const dynamic = "force-dynamic";

/** Internal tool — kept out of search engines. */
export const metadata: Metadata = {
  title: "Produktsök — Pouch Club",
  description: "Internt produktsök för butikspersonal.",
  robots: { index: false, follow: false },
};

/** Open without a login, same as the brand pages. */
export default async function FinderPage() {
  const products = await listProductsForFinder();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Produktsök</h1>
      <p className="mt-1 text-zinc-600">
        Hitta rätt produkt åt kunden — filtrera på kategori, styrka, format och smak.
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        Visar vårt sortiment, inte vad som finns i hyllan just nu.
      </p>

      <ProductFinder products={products} />

      <p className="mt-8 text-sm">
        <Link href="/staff" className="underline underline-offset-4">
          Till varumärkesguiden
        </Link>
      </p>
    </main>
  );
}
