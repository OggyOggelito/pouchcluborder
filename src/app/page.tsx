import OrderForm from "@/components/OrderForm";
import StorePicker from "@/components/StorePicker";
import { getCurrentStore } from "@/lib/current-store";
import { listActiveProducts } from "@/lib/repositories/products";
import { listStores } from "@/lib/repositories/stores";

export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const [store, stores] = await Promise.all([getCurrentStore(), listStores()]);

  if (!store) {
    return <StorePicker stores={stores} />;
  }

  const products = await listActiveProducts();

  if (products.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Inga produkter i katalogen</h1>
        <p className="mt-2 text-zinc-600">
          Importera katalogen på <a className="underline" href="/admin">/admin</a> eller kör{" "}
          <code className="font-mono">npm run seed</code>.
        </p>
      </main>
    );
  }

  return <OrderForm store={store} products={products} />;
}
