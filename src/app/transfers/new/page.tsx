import { notFound } from "next/navigation";
import TransferBuilder from "@/components/TransferBuilder";
import { prisma } from "@/lib/db";
import { listProductsForFinder } from "@/lib/repositories/products";
import { listStores } from "@/lib/repositories/stores";
import { canAccessAdmin, canAccessAllStores, canPlaceOrders } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewTransferPage() {
  const user = await requireUser("/transfers/new");
  // STAFF may read transfers but not create them.
  if (!canPlaceOrders(user.role)) notFound();

  const allStores = await listStores();
  const mine = canAccessAllStores(user.role) ? allStores : user.stores;
  if (mine.length === 0) notFound();

  // The region of the first store the user can request for; the builder
  // re-reads this server-side on submit, so this is only for the dropdown.
  const primary = await prisma.store.findUnique({
    where: { id: mine[0].id },
    select: { region: true },
  });

  const inRegion = await prisma.store.findMany({
    where: { region: primary?.region ?? "__none__", NOT: { id: mine[0].id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, city: true },
  });

  const products = (await listProductsForFinder()).map((product) => ({
    id: product.id,
    label: `${product.brand} ${product.flavor} ${product.strength} ${product.format}`.trim(),
  }));

  return (
    <main className="mx-auto max-w-lg px-4 pb-20 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ny förfrågan</h1>
      <p className="mt-1 text-zinc-600">
        Fråga en annan butik om de kan avvara något.
      </p>

      <TransferBuilder
        stores={mine}
        regionStores={inRegion}
        allStores={allStores}
        isAdmin={canAccessAdmin(user.role)}
        products={products}
      />
    </main>
  );
}
