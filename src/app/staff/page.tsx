import { listPublishedBrands } from "@/lib/repositories/brands";
import BrandDirectory from "@/components/BrandDirectory";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Varumärkesguide — Pouch Club",
  description: "Om varumärkena vi säljer: tillverkning, blandning och bakgrund.",
};

/**
 * Deliberately outside the auth system — any staff member can read this on the
 * shop floor without an account.
 */
export default async function StaffPage() {
  const brands = await listPublishedBrands();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Varumärkesguide</h1>
      <p className="mt-1 text-zinc-600">
        Hur produkterna tillverkas, hur nikotinet blandas och vad som skiljer märkena åt.
      </p>

      {brands.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga publicerade varumärken än. Skriv innehåll under{" "}
          <span className="font-mono">/admin/brands</span> och publicera det.
        </p>
      ) : (
        <BrandDirectory brands={brands} />
      )}
    </main>
  );
}
