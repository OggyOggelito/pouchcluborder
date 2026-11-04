import Link from "next/link";
import OrderForm from "@/components/OrderForm";
import StorePicker from "@/components/StorePicker";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { resolveOrderingStore } from "@/lib/current-store";
import { pruneToCatalog } from "@/lib/order-drafts";
import { getDraft } from "@/lib/repositories/order-drafts";
import { listActiveProducts } from "@/lib/repositories/products";
import { requireOrderingUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Beställ — Pouch Club",
};

/**
 * The order form.
 *
 * Lived at `/` until the portal grew a role-aware home; `/` now shows "Idag"
 * with "Ny beställning" as its one big button, which is where this is reached
 * from. `?store=` lets the home page's "Fortsätt beställning" card open the
 * right basket when someone covers more than one store.
 */
export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const user = await requireOrderingUser("/order");
  const { store: storeParam } = await searchParams;
  const resolution = await resolveOrderingStore(user, storeParam);

  if (resolution.kind === "none") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader title="Ingen butik kopplad" />
        <p className="text-zinc-700">
          Kontot <span className="font-medium">{user.email}</span> har ännu ingen butik. Be en
          administratör koppla en butik till kontot.
        </p>
      </main>
    );
  }

  if (resolution.kind === "choose") {
    return <StorePicker stores={resolution.choices} />;
  }

  const [products, draft] = await Promise.all([
    listActiveProducts(),
    getDraft(user.id, resolution.store.id),
  ]);

  if (products.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader title="Inga produkter i katalogen" />
        <EmptyState
          title="Katalogen är tom"
          description="Importera leverantörens masterdoc så dyker sortimentet upp här."
          action={
            <Link
              href="/admin"
              className="inline-flex min-h-tap items-center rounded-2xl bg-zinc-900 px-5 font-semibold text-white"
            >
              Till importen
            </Link>
          }
        />
      </main>
    );
  }

  // A draft can outlive a catalog re-import, so lines whose product is gone
  // are dropped here rather than failing at submit.
  const pruned = draft
    ? pruneToCatalog(
        draft.lines,
        products.map((product) => product.id)
      )
    : null;

  return (
    <OrderForm
      store={resolution.store}
      products={products}
      canSwitchStore={resolution.choices.length > 1}
      initialDraft={
        draft && pruned
          ? { lines: pruned.lines, note: draft.note ?? "", version: draft.version }
          : null
      }
    />
  );
}
