import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { listBrandsForAdmin } from "@/lib/repositories/brands";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  await requireAdmin();
  const brands = await listBrandsForAdmin();
  const published = brands.filter((brand) => brand.published).length;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Varumärkesinnehåll</h1>
      <p className="mt-1 text-zinc-600">
        {published} av {brands.length} publicerade.{" "}
        <Link href="/staff" className="underline underline-offset-4">
          Visa guiden
        </Link>
      </p>

      <ul className="mt-5 space-y-2">
        {brands.map((brand) => (
          <li key={brand.id}>
            <Link
              href={`/admin/brands/${brand.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-zinc-300"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{brand.name}</span>
                  {brand.published ? (
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      Publicerad
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                      Utkast
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-sm text-zinc-500">
                  {brand.shortDescription ?? "Inget innehåll än"}
                </span>
                {brand.categories.length > 0 ? (
                  <span className="mt-0.5 block text-xs text-zinc-400">
                    {brand.categories.map(categoryLabel).join(" · ")}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-sm text-zinc-400 tabular-nums">
                {brand.productCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
