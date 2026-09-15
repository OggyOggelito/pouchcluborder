import { NextResponse } from "next/server";
import { parseProductCsv } from "@/lib/csv";
import { importProducts, type ImportMode } from "@/lib/repositories/products";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    return NextResponse.json({
      ...result,
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
