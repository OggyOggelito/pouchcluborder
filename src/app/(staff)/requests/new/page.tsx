import Link from "next/link";
import RequestLogger from "@/components/RequestLogger";
import { listProductsForFinder } from "@/lib/repositories/products";
import { listStores } from "@/lib/repositories/stores";
import { canAccessAllStores } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Any signed-in staff member may log a request for a store they work in. */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser("/requests/new");
  const { q } = await searchParams;

  const stores = canAccessAllStores(user.role) ? await listStores() : user.stores;

  if (stores.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Kundönskemål</h1>
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

  return (
    <main className="mx-auto max-w-lg px-4 pb-20 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Kundönskemål</h1>
      <p className="mt-1 text-muted">
        Frågade en kund efter något vi inte kunde sälja? Logga det här, så ser inköp vad som
        efterfrågas.
      </p>

      <RequestLogger stores={stores} initialText={q ?? ""} products={products} />

      <p className="mt-8 text-sm">
        <Link href="/staff/finder" className="underline underline-offset-4">
          Till produktsöket
        </Link>
      </p>
    </main>
  );
}
