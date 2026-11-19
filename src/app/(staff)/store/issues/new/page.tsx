import Link from "next/link";
import IssueReportForm from "@/components/IssueReportForm";
import { isIssueCategory, type IssueCategory } from "@/lib/issues";
import { listProductsForFinder } from "@/lib/repositories/products";
import { listStores } from "@/lib/repositories/stores";
import { canAccessAllStores } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ny problemrapport — Pouch Club",
};

/**
 * Filing a report.
 *
 * `store`, `product`, `text` and `category` may arrive prefilled from another
 * page. Every one of them is validated here: the store must be one the account
 * can act on, and the product must exist in the catalog.
 */
export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; product?: string; text?: string; category?: string }>;
}) {
  const user = await requireUser("/store/issues/new");
  const params = await searchParams;

  const stores = canAccessAllStores(user.role) ? await listStores() : user.stores;

  if (stores.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Ny problemrapport</h1>
        <p className="mt-2 text-muted">
          Ditt konto är inte kopplat till någon butik. Be en administratör koppla en.
        </p>
      </main>
    );
  }

  const products = (await listProductsForFinder()).map((product) => ({
    id: product.id,
    label: `${product.brand} ${product.flavor} ${product.strength} ${product.format}`.trim(),
  }));

  const prefillStore = stores.find((store) => store.id === params.store)?.id ?? "";
  const prefillProduct = products.find((product) => product.id === params.product)?.id ?? "";
  const prefillCategory: IssueCategory | null = isIssueCategory(params.category)
    ? params.category
    : null;

  return (
    <main className="mx-auto max-w-lg px-4 pb-20 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ny problemrapport</h1>
      <p className="mt-1 text-muted">
        Beskriv kort vad som är fel. En administratör tar över och du ser statusen här i appen.
      </p>

      <IssueReportForm
        stores={stores}
        products={products}
        prefill={{
          storeId: prefillStore,
          productId: prefillProduct,
          text: (params.text ?? "").slice(0, 1000),
          category: prefillCategory,
        }}
      />

      <p className="mt-8 text-sm">
        <Link href="/store/issues" className="underline underline-offset-4">
          Till alla rapporter
        </Link>
      </p>
    </main>
  );
}
