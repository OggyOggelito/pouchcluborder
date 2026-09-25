import { NextResponse } from "next/server";
import { parseShiftCsv, parseShiftIcs } from "@/lib/schedule/import";
import { importShifts } from "@/lib/repositories/shifts";
import { canAccessAllStores } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Filen är för stor (max 10 MB)." }, { status: 400 });
  }

  const text = await file.text();

  // Picked from the content, not the extension — exports are routinely saved
  // with the wrong one.
  const looksLikeIcs = /BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(text);
  const source = looksLikeIcs ? "ics" : "csv";

  try {
    const parsed = looksLikeIcs ? parseShiftIcs(text) : parseShiftCsv(text);

    if (parsed.shifts.length === 0) {
      return NextResponse.json(
        {
          error: "Hittade inga pass i filen.",
          source,
          errors: parsed.errors.slice(0, 20),
          errorCount: parsed.errors.length,
        },
        { status: 400 }
      );
    }

    const result = await importShifts(parsed.shifts, source);

    return NextResponse.json({
      ...result,
      source,
      fileName: file.name,
      parsed: parsed.shifts.length,
      errors: parsed.errors.slice(0, 20),
      errorCount: parsed.errors.length,
    });
  } catch (error) {
    console.error("Shift import failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Importen misslyckades." },
      { status: 500 }
    );
  }
}
