import { NextResponse } from "next/server";
import { parseProductCsv } from "@/lib/csv";
import { importProducts, type ImportMode } from "@/lib/repositories/products";
import { syncBrandsFromProducts } from "@/lib/repositories/brands";
import { getSessionUser } from "@/lib/session";
import { canAccessAllStores } from "@/lib/roles";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Replacing the catalog is an admin action — without this, anyone who can
  // reach the app could overwrite every product.
  const user = await getSessionUser();
  if (!user || !canAccessAllStores(user.role)) {
    return NextResponse.json({ error: "Behörighet saknas." }, { status: 403 });
  }

  let body: { csv?: unknown; mode?: unknown };

  try {
    body = (await request.json()) as { csv?: unknown; mode?: unknown };
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  if (typeof body.csv !== "string" || body.csv.trim() === "") {
    return NextResponse.json({ error: "Ingen CSV-data mottagen." }, { status: 400 });
  }

  const mode: ImportMode = body.mode === "replace" ? "replace" : "merge";
  const parsed = parseProductCsv(body.csv);

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error: "Hittade inga giltiga rader att importera.",
        errors: parsed.errors.slice(0, 20),
        headers: parsed.headers,
      },
      { status: 400 }
    );
  }

  try {
    const result = await importProducts(parsed.rows, mode);
    // Same as the .xlsx path: a brand new to this import gets a draft page.
    const brands = await syncBrandsFromProducts();
    return NextResponse.json({
      ...result,
      brands,
      mode,
      parsed: parsed.rows.length,
      errors: parsed.errors.slice(0, 20),
      errorCount: parsed.errors.length,
    });
  } catch (error) {
    console.error("Catalog import failed", error);
    return NextResponse.json({ error: "Importen misslyckades." }, { status: 500 });
  }
}
