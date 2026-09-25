import { notFound } from "next/navigation";
import { getTeamSchedule } from "@/lib/schedule/queries";
import { canAccessAllStores } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const WEEKDAY = new Intl.DateTimeFormat("sv-SE", { weekday: "short", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("sv-SE", { day: "numeric", timeZone: "UTC" });

/**
 * Read-only coverage grid. No request/accept workflow by design — a manager who
 * wants cover contacts the person directly, so their phone and email are shown.
 */
export default async function TeamSchedulePage() {
  const user = await requireUser("/team-schedule");

  // OWNER and ADMIN only. Any future non-managing role gets a 404 rather than
  // a view of everyone's whereabouts.
  if (user.role !== "OWNER" && !canAccessAllStores(user.role)) notFound();

  const { regions, days, members, shiftsByUserDay, providerName } = await getTeamSchedule(user);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Teamschema</h1>
      <p className="mt-1 text-zinc-600">
        {regions.length > 0 ? regions.join(", ") : "Ingen region satt"} ·{" "}
        {members.length} personer · {days.length} dagar
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        Tom ruta = ledig. Vill du be någon täcka ett pass, hör av dig direkt — kontaktuppgifter
        finns i listan.
      </p>

      {members.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga medarbetare kopplade till butikerna i din region.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold">
                  Medarbetare
                </th>
                {days.map((day) => (
                  <th key={day.key} className="px-2 py-2 text-center font-medium text-zinc-500">
                    <span className="block capitalize">{WEEKDAY.format(day.date)}</span>
                    <span className="block text-xs tabular-nums">{DAY.format(day.date)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-zinc-100 last:border-b-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 align-top">
                    <span className="block font-medium">{member.name ?? member.email}</span>
                    <span className="block text-xs text-zinc-500">{member.storeNames.join(", ")}</span>
                    <span className="mt-0.5 block text-xs">
                      <a
                        href={`mailto:${member.email}`}
                        className="text-zinc-500 underline underline-offset-2"
                      >
                        {member.email}
                      </a>
                      {member.phone ? (
                        <>
                          {" · "}
                          <a
                            href={`tel:${member.phone.replace(/\s/g, "")}`}
                            className="text-zinc-500 underline underline-offset-2"
                          >
                            {member.phone}
                          </a>
                        </>
                      ) : null}
                    </span>
                  </td>

                  {days.map((day) => {
                    const shifts = shiftsByUserDay.get(`${member.id}|${day.key}`) ?? [];
                    const off = shifts.length === 0;
                    return (
                      <td
                        key={day.key}
                        className={`px-2 py-2 text-center align-top ${off ? "bg-zinc-50" : ""}`}
                      >
                        {off ? (
                          <span className="text-zinc-300" title="Ledig">
                            ·
                          </span>
                        ) : (
                          shifts.map((shift) => (
                            <span
                              key={`${shift.startTime}-${shift.storeName}`}
                              className="mb-1 block rounded-md bg-brand-50 px-1 py-0.5 text-xs font-medium text-brand-700"
                              title={shift.storeName}
                            >
                              {shift.startTime}–{shift.endTime}
                            </span>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-400">Källa: {providerName}.</p>
    </main>
  );
}
