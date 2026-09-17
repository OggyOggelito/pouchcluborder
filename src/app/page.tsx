import Link from "next/link";
import OrderForm from "@/components/OrderForm";
import StorePicker from "@/components/StorePicker";
import { resolveOrderingStore } from "@/lib/current-store";
import { listActiveProducts } from "@/lib/repositories/products";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const user = await requireUser("/");
  const resolution = await resolveOrderingStore(user);

  if (resolution.kind === "none") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Ingen butik kopplad</h1>
        <p className="mt-2 text-zinc-600">
          Kontot <span className="font-medium">{user.email}</span> har ännu ingen butik. Be en
          administratör koppla en butik till kontot på <code className="font-mono">/admin/users</code>.
        </p>
      </main>
    );
  }

  if (resolution.kind === "choose") {
    return <StorePicker stores={resolution.choices} />;
  }

  const products = await listActiveProducts();

  if (products.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Inga produkter i katalogen</h1>
        <p className="mt-2 text-zinc-600">
          Importera katalogen på{" "}
          <Link className="underline" href="/admin">
            /admin
          </Link>{" "}
          eller kör <code className="font-mono">npm run seed</code>.
        </p>
      </main>
    );
  }

  return (
    <OrderForm
      store={resolution.store}
      products={products}
      canSwitchStore={resolution.choices.length > 1}
    />
  );
}
