import { NextResponse } from "next/server";
import { parseSupplierWorkbook, PRICE_BASIS } from "@/lib/supplier-xlsx";
import { importProducts, type ImportMode } from "@/lib/repositories/products";
import { syncBrandsFromProducts } from "@/lib/repositories/brands";
import { getSessionUser } from "@/lib/session";
import { canAccessAllStores } from "@/lib/roles";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  // Replacing the catalog is an admin action — without this, anyone who can
  // reach the app could overwrite every product.
  const user = await getSessionUser();
  if (!user || !canAccessAllStores(user.role)) {
    return NextResponse.json({ error: "Behörighet saknas." }, { status: 403 });
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ingen fil mottagen." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Filen är för stor (${(file.size / 1024 / 1024).toFixed(1)} MB, max 25 MB).` },
      { status: 400 }
    );
  }

  // Replace is the default here for the same reason the CSV path uses it:
  // products are deactivated rather than deleted, so past orders keep their
  // line items.
  const mode: ImportMode = form.get("mode") === "merge" ? "merge" : "replace";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseSupplierWorkbook(buffer);

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "Hittade inga giltiga rader i filen.", stats: parsed.stats },
        { status: 400 }
      );
    }

    const result = await importProducts(parsed.rows, mode);

    // Give any brand new to this import a (draft, empty) page, and keep
    // Product.brandId pointing at the right Brand — rather than re-parsing the
    // brand out of the name on every read.
    const brands = await syncBrandsFromProducts();

    return NextResponse.json({
      brands,
      ...result,
      mode,
      priceBasis: PRICE_BASIS,
      fileName: file.name,
      stats: parsed.stats,
      problems: parsed.problems.slice(0, 20),
      problemCount: parsed.problems.length,
    });
  } catch (error) {
    console.error("Supplier import failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Importen misslyckades." },
      { status: 500 }
    );
  }
}
