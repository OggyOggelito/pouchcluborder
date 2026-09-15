import Link from "next/link";
import CsvImport from "@/components/CsvImport";
import SupplierImport from "@/components/SupplierImport";
import { countProducts, countNeedsReview, listBrands } from "@/lib/repositories/products";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [counts, brands, review] = await Promise.all([
    countProducts(),
    listBrands(),
    countNeedsReview(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-zinc-600">
        {counts.active} aktiva produkter av {counts.total} totalt, {brands.length} märken.
        {review > 0 ? (
          <>
            {" "}
            <strong className="text-amber-700">{review} behöver granskas.</strong>
          </>
        ) : null}
      </p>

      <SupplierImport />
      <CsvImport />

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Märken i katalogen</h2>
        {brands.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Katalogen är tom.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {brands.map((brand) => (
              <li
                key={brand}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
              >
                {brand}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-sm text-zinc-500">
        Den här sidan är öppen i Phase 1 — ingen inloggning. Se README för var auth ska in.{" "}
        <Link href="/" className="underline underline-offset-4">
          Till beställningen
        </Link>
        .
      </p>
    </main>
  );
}
