import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { stockholmDateKey } from "@/lib/checklists";
import { DEMO_STATUS_LABELS_STAFF, toDemoStatus } from "@/lib/demo-days";
import { addDaysToDate, isDateString } from "@/lib/schedule/time";
import { listAllBookings } from "@/lib/repositories/demo-days";
import { canAccessAdmin } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

/** The admin demo-day list as a workbook. ADMIN only, checked here. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Du måste vara inloggad." }, { status: 401 });
  if (!canAccessAdmin(user.role)) {
    return NextResponse.json({ error: "Saknar behörighet." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const today = stockholmDateKey();
  const from = isDateString(params.get("fran")) ? params.get("fran")! : today;
  const to = isDateString(params.get("till")) ? params.get("till")! : addDaysToDate(today, 90);

  const bookings = await listAllBookings({
    from,
    to,
    storeId: params.get("butik"),
    brandId: null,
    status: params.get("status") ? toDemoStatus(params.get("status")) : null,
  });

  const rows: (string | number)[][] = [
    ["Datum", "Butik", "Varumärke", "Från", "Till", "Status", "Meddelande", "Svar"],
    ...bookings.map((booking) => [
      booking.date,
      booking.store.name,
      booking.brand.name,
      booking.startsAt,
      booking.endsAt,
      DEMO_STATUS_LABELS_STAFF[booking.status],
      booking.note ?? "",
      booking.decisionNote ?? "",
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 18 },
    { wch: 8 },
    { wch: 8 },
    { wch: 20 },
    { wch: 40 },
    { wch: 30 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Demodagar");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="demodagar-${from}-${to}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
