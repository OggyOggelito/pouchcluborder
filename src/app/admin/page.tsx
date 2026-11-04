import Link from "next/link";
import CsvImport from "@/components/CsvImport";
import SupplierImport from "@/components/SupplierImport";
import { ADMIN_ENTRIES } from "@/config/navigation";
import { countProducts, countNeedsReview, listBrands } from "@/lib/repositories/products";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();

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

      {/* The sub-pages, straight from the route registry — the header only
          links /admin itself, so without this they are URL-only. */}
      <nav className="mt-5 grid gap-2 sm:grid-cols-2">
        {ADMIN_ENTRIES.filter((entry) => entry.visible(user.role)).map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99] hover:border-zinc-300"
          >
            <span className="block font-semibold tracking-tight">{entry.label}</span>
            {entry.description ? (
              <span className="block text-sm text-zinc-500">{entry.description}</span>
            ) : null}
          </Link>
        ))}
      </nav>

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
