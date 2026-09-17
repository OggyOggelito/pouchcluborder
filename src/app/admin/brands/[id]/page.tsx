import { notFound } from "next/navigation";
import BrandEditor from "@/components/BrandEditor";
import { getBrandById } from "@/lib/repositories/brands";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const brand = await getBrandById(id);
  if (!brand) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">{brand.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        /staff/brands/<span className="font-mono">{brand.slug}</span>
      </p>
      <BrandEditor brand={brand} />
    </main>
  );
}
