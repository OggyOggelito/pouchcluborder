import Link from "next/link";
import { saveFlavorTagsAction } from "@/lib/admin-actions";
import { categoryLabel } from "@/lib/categories";
import { FLAVOR_GROUPS, FLAVOR_GROUP_LABELS, UNTAGGED_LABEL } from "@/lib/flavor-tags";
import { prisma } from "@/lib/db";
import { listUntaggedProducts } from "@/lib/repositories/products";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Products no keyword rule matched. An admin sorts them by hand here, which
 * sets `tagsEditedByAdmin` so a re-import never undoes the work.
 */
export default async function FlavorTagsPage() {
  await requireAdmin();

  const [untagged, editedCount, taggedCount] = await Promise.all([
    listUntaggedProducts(),
    prisma.product.count({ where: { tagsEditedByAdmin: true } }),
    prisma.product.count({ where: { active: true, flavorTags: { not: null } } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">{UNTAGGED_LABEL}</h1>
      <p className="mt-1 text-muted">
        {untagged.length} aktiva produkter matchade ingen regel. {taggedCount} har en grupp,{" "}
        {editedCount} är handsorterade.
      </p>
      <p className="mt-1 text-sm text-muted">
        Reglerna finns i <code className="font-mono">src/lib/flavor-tags.ts</code>. Det du sparar
        här skrivs aldrig över av <code className="font-mono">npm run flavors:retag</code>.
      </p>

      {untagged.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-control p-6 text-center text-muted">
          Alla aktiva produkter har en smakgrupp.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {untagged.map((product) => (
            <li
              key={product.id}
              className="rounded-2xl border border-line bg-surface p-4 shadow-sm"
            >
              <p className="font-medium">
                {product.brand} <span className="font-normal text-muted">{product.flavor}</span>
              </p>
              <p className="text-sm text-muted">
                {product.strength || "—"} · {product.format}
                {product.category ? ` · ${categoryLabel(product.category)}` : ""}
              </p>

              <form action={saveFlavorTagsAction} className="mt-3">
                <input type="hidden" name="productId" value={product.id} />
                <div className="flex flex-wrap gap-2">
                  {FLAVOR_GROUPS.map((group) => (
                    <label
                      key={group}
                      className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm"
                    >
                      <input type="checkbox" name="tags" value={group} className="h-4 w-4" />
                      {FLAVOR_GROUP_LABELS[group]}
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  className="mt-3 h-11 rounded-xl border border-control px-5 text-sm font-medium transition hover:bg-raised"
                >
                  Spara grupper
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm">
        <Link href="/staff/finder" className="underline underline-offset-4">
          Till produktsöket
        </Link>
      </p>
    </main>
  );
}
