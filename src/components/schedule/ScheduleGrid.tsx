"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import WarningList from "@/components/schedule/WarningList";
import {
  clearDayAction,
  deleteShiftAction,
  saveShiftAction,
} from "@/lib/schedule-actions";
import { NO_PERSONAL_DATA_SHORT } from "@/lib/privacy";
import type { ScheduleWeek, WeekDay, WeekShift } from "@/lib/schedule/grid";
import { MAX_SHIFT_NOTE_LENGTH } from "@/lib/schedule/week";
import {
  WEEKDAY_SHORT,
  formatDateString,
  formatHours,
  formatLongDateString,
  formatRange,
  toMinutes,
} from "@/lib/schedule/time";
import { compactTime } from "@/lib/schedule/opening-hours";

/**
 * The week grid.
 *
 * Two layouts of the same week, chosen by CSS rather than by a media query in
 * JavaScript: a day at a time on a phone, the whole week as a table from
 * tablet up. The shop floor is a phone; the person building next week's rota
 * is usually at a desk, and asking them to read seven columns through a
 * horizontal scroll was the thing the old imported grid got wrong.
 *
 * Saving happens per change, not behind a Spara button. A template chip writes
 * immediately; typed times and notes write a second after the typing stops.
 * The state of that save is always on screen — "Sparat" or, loudly, that it
 * failed.
 */
const AUTOSAVE_DELAY_MS = 1000;

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Editing = {
  employeeId: string;
  employeeName: string;
  date: string;
  shiftId: string | null;
};

type Form = { startsAt: string; endsAt: string; note: string };

export default function ScheduleGrid({
  week,
  canEdit,
  todayKey,
}: {
  week: ScheduleWeek;
  canEdit: boolean;
  /** Today in Europe/Stockholm, resolved on the server. */
  todayKey: string;
}) {
  const router = useRouter();

  const [activeDate, setActiveDate] = useState(
    week.dates.includes(todayKey) ? todayKey : week.dates[0]
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  const activeDay = week.days.find((day) => day.date === activeDate) ?? week.days[0];

  function openEditor(next: Editing) {
    setSave({ kind: "idle" });
    setEditing(next);
  }

  return (
    <>
      {/* Phone: one day at a time. */}
      <div className="md:hidden">
        <DayStrip
          week={week}
          activeDate={activeDate}
          todayKey={todayKey}
          onPick={setActiveDate}
        />
        <DayPanel
          week={week}
          day={activeDay}
          canEdit={canEdit}
          onEdit={openEditor}
        />
      </div>

      {/* Tablet and up: the whole week. */}
      <div className="hidden md:block">
        <WeekTable week={week} canEdit={canEdit} todayKey={todayKey} onEdit={openEditor} />
      </div>

      {editing ? (
        <ShiftEditor
          // Keyed on what the editor is editing, so opening another cell
          // starts fresh. Deliberately not on the shift id: that would remount
          // the moment a new shift saves and reseed the form from a week the
          // refresh has not delivered yet — the fields would snap back to the
          // default template while the status said "Sparat".
          key={`${editing.employeeId}|${editing.date}|${editing.shiftId ?? "new"}`}
          week={week}
          editing={editing}
          save={save}
          setSave={setSave}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Phone: a day at a time
// ---------------------------------------------------------------------------

function DayStrip({
  week,
  activeDate,
  todayKey,
  onPick,
}: {
  week: ScheduleWeek;
  activeDate: string;
  todayKey: string;
  onPick: (date: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Veckans dagar"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
    >
      {week.days.map((day) => {
        const selected = day.date === activeDate;
        const count = day.shifts.length;
        return (
          <button
            key={day.date}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onPick(day.date)}
            className={`min-h-tap shrink-0 rounded-2xl border px-3 py-2 text-center transition ${
              selected
                ? "border-primary bg-raised ring-1 ring-primary"
                : "border-control bg-surface"
            }`}
          >
            <span className="block text-xs capitalize text-muted">
              {WEEKDAY_SHORT[day.hours.weekday]}
              {day.date === todayKey ? " · idag" : ""}
            </span>
            <span className="block text-sm font-semibold tabular-nums">
              {day.date.slice(8)}/{Number(day.date.slice(5, 7))}
            </span>
            <span className="block text-xs text-muted">
              {day.hours.closed ? "Stängt" : count === 0 ? "–" : `${count} pass`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DayPanel({
  week,
  day,
  canEdit,
  onEdit,
}: {
  week: ScheduleWeek;
  day: WeekDay;
  canEdit: boolean;
  onEdit: (editing: Editing) => void;
}) {
  const scheduled = new Set(day.shifts.map((shift) => shift.employeeId));
  const free = week.employees.filter((employee) => employee.own && !scheduled.has(employee.id));

  return (
    <section className="mt-3">
      <h2 className="text-lg font-semibold capitalize tracking-tight">
        {formatLongDateString(day.date)}
      </h2>
      <p className="mt-0.5 text-sm text-muted">{day.coverageText}</p>
      {day.hours.note ? (
        <p className="mt-0.5 text-sm text-muted">{day.hours.note}</p>
      ) : null}

      <WarningList warnings={day.warnings} className="mt-2" />

      <ul className="mt-3 space-y-2">
        {day.shifts.map((shift) => (
          <li key={shift.id}>
            <ShiftButton
              shift={shift}
              canEdit={canEdit}
              homeStoreName={
                week.employees.find((employee) => employee.id === shift.employeeId)?.own === false
                  ? week.employees.find((employee) => employee.id === shift.employeeId)
                      ?.homeStoreName ?? null
                  : null
              }
              onEdit={() =>
                onEdit({
                  employeeId: shift.employeeId,
                  employeeName: shift.employeeName,
                  date: day.date,
                  shiftId: shift.id,
                })
              }
            />
          </li>
        ))}
      </ul>

      {canEdit && free.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Lägg in ett pass</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {free.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() =>
                  onEdit({
                    employeeId: employee.id,
                    employeeName: employee.name,
                    date: day.date,
                    shiftId: null,
                  })
                }
                className="min-h-tap rounded-full border border-control bg-surface px-4 text-sm font-medium transition hover:border-primary"
              >
                + {employee.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {day.shifts.length === 0 && free.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-control p-5 text-center text-sm text-muted">
          Inga medarbetare är kopplade till butiken ännu.
        </p>
      ) : null}
    </section>
  );
}

function ShiftButton({
  shift,
  canEdit,
  homeStoreName,
  onEdit,
}: {
  shift: WeekShift;
  canEdit: boolean;
  homeStoreName: string | null;
  onEdit: () => void;
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block font-medium">{shift.employeeName}</span>
        <span className="block text-sm text-muted">
          {homeStoreName ? `Extrapass · ${homeStoreName}` : null}
          {homeStoreName && shift.note ? " · " : null}
          {shift.note}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-medium tabular-nums">
          {formatRange(shift.startsAt, shift.endsAt)}
        </span>
        <span className="block text-xs text-muted">
          {formatHours(toMinutes(shift.endsAt) - toMinutes(shift.startsAt))}
        </span>
      </span>
    </>
  );

  const className =
    "flex w-full min-h-tap items-center justify-between gap-3 rounded-2xl border bg-surface px-4 py-3 text-left transition";

  if (!canEdit) {
    return <div className={`${className} border-line`}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className={`${className} ${shift.isExtra ? "border-primary" : "border-line"} hover:border-control active:scale-[0.99]`}
    >
      {body}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Desktop: the week
// ---------------------------------------------------------------------------

function WeekTable({
  week,
  canEdit,
  todayKey,
  onEdit,
}: {
  week: ScheduleWeek;
  canEdit: boolean;
  todayKey: string;
  onEdit: (editing: Editing) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Schema för {week.store.name}, vecka {week.weekNumber}. Rader är medarbetare, kolumner
          är dagar.
        </caption>
        <thead>
          <tr className="border-b border-line align-top">
            <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left">
              Medarbetare
            </th>
            {week.days.map((day) => (
              <th
                scope="col"
                key={day.date}
                className={`min-w-36 px-2 py-2 text-left font-medium ${
                  day.date === todayKey ? "bg-raised" : ""
                }`}
              >
                <span className="block capitalize">
                  {WEEKDAY_SHORT[day.hours.weekday]} {day.date.slice(8)}/
                  {Number(day.date.slice(5, 7))}
                </span>
                <span className="block text-xs font-normal text-muted">
                  {day.hours.source === "missing"
                    ? "Öppettider saknas"
                    : day.hours.closed
                      ? "Stängt"
                      : `${compactTime(day.hours.opensAt!)}–${compactTime(day.hours.closesAt!)}`}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {week.employees.map((employee) => (
            <tr key={employee.id} className="border-b border-line align-top">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium"
              >
                {employee.name}
                {employee.own ? null : (
                  <span className="block text-xs font-normal text-muted">
                    Extrapass · {employee.homeStoreName}
                  </span>
                )}
              </th>

              {week.days.map((day) => {
                const own = day.shifts.filter((shift) => shift.employeeId === employee.id);
                const cellTone = day.date === todayKey ? "bg-raised" : "";

                if (!canEdit) {
                  return (
                    <td key={day.date} className={`px-2 py-2 ${cellTone}`}>
                      {own.length === 0 ? (
                        <span className="text-xs text-muted">Ledig</span>
                      ) : (
                        own.map((shift) => (
                          <span key={shift.id} className="block tabular-nums">
                            {formatRange(shift.startsAt, shift.endsAt)}
                          </span>
                        ))
                      )}
                    </td>
                  );
                }

                return (
                  <td key={day.date} className={`p-1 ${cellTone}`}>
                    {own.map((shift) => (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() =>
                          onEdit({
                            employeeId: employee.id,
                            employeeName: employee.name,
                            date: day.date,
                            shiftId: shift.id,
                          })
                        }
                        className={`mb-1 block w-full rounded-xl border px-2 py-1.5 text-left transition hover:border-primary ${
                          shift.isExtra ? "border-primary bg-raised" : "border-line bg-raised"
                        }`}
                      >
                        <span className="block tabular-nums">
                          {formatRange(shift.startsAt, shift.endsAt)}
                        </span>
                        {shift.note ? (
                          <span className="block truncate text-xs text-muted">{shift.note}</span>
                        ) : null}
                        <span className="sr-only">
                          {employee.name}, {formatDateString(day.date)} — ändra passet
                        </span>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        onEdit({
                          employeeId: employee.id,
                          employeeName: employee.name,
                          date: day.date,
                          shiftId: null,
                        })
                      }
                      className="block w-full rounded-xl border border-dashed border-control px-2 py-1.5 text-left text-xs text-muted transition hover:border-primary hover:text-ink"
                    >
                      <span aria-hidden>+ </span>
                      {own.length === 0 ? "Lägg in" : "Till"}
                      <span className="sr-only">
                        {" "}
                        pass för {employee.name} {formatDateString(day.date)}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}

          {week.employees.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-muted">
                Inga medarbetare är kopplade till butiken ännu.
              </td>
            </tr>
          ) : null}
        </tbody>

        <tfoot>
          <tr className="align-top">
            <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left">
              Bemanning
            </th>
            {week.days.map((day) => (
              <td key={day.date} className="px-2 py-2">
                <span className="block text-xs text-muted">{day.coverageText}</span>
                <WarningList warnings={day.warnings} className="mt-1" />
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

function ShiftEditor({
  week,
  editing,
  save,
  setSave,
  onClose,
  onSaved,
}: {
  week: ScheduleWeek;
  editing: Editing;
  save: SaveState;
  setSave: (state: SaveState) => void;
  onClose: () => void;
  /** The week behind the sheet is stale after a write; this re-reads it. */
  onSaved: () => void;
}) {
  const day = week.days.find((candidate) => candidate.date === editing.date)!;
  const shift = editing.shiftId
    ? (day.shifts.find((candidate) => candidate.id === editing.shiftId) ?? null)
    : null;

  const [form, setForm] = useState<Form>({
    startsAt: shift?.startsAt ?? day.templates[0]?.startsAt ?? "10:00",
    endsAt: shift?.endsAt ?? day.templates[0]?.endsAt ?? "18:00",
    note: shift?.note ?? "",
  });

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const shiftIdRef = useRef<string | null>(editing.shiftId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compared against the ref, not the shift this editor opened on: a shift
  // created a moment ago is this one, and listing it as "already has" would be
  // the editor warning about its own work.
  const othersThatDay = day.shifts.filter(
    (candidate) =>
      candidate.employeeId === editing.employeeId && candidate.id !== shiftIdRef.current
  );

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("button, input, textarea")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [onClose]);

  async function write(next: Form) {
    setSave({ kind: "saving" });
    const result = await saveShiftAction({
      id: shiftIdRef.current,
      storeId: week.store.id,
      employeeId: editing.employeeId,
      date: editing.date,
      startsAt: next.startsAt,
      endsAt: next.endsAt,
      note: next.note,
    });

    if (result.kind === "saved") {
      // The id lives in a ref rather than in state: a new shift must not
      // change this component's key while somebody is typing in it.
      if (result.id) shiftIdRef.current = result.id;
      setSave({ kind: "saved" });
      onSaved();
      return;
    }
    setSave({
      kind: "error",
      message:
        result.kind === "denied"
          ? "Du har inte behörighet att ändra den här butikens schema."
          : result.message,
    });
  }

  /** Typed changes save a second after the typing stops. */
  function change(patch: Partial<Form>) {
    const next = { ...form, ...patch };
    setForm(next);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void write(next), AUTOSAVE_DELAY_MS);
  }

  /** A template is one tap and saves at once — no waiting, no Spara. */
  function applyTemplate(startsAt: string, endsAt: string) {
    if (timer.current) clearTimeout(timer.current);
    const next = { ...form, startsAt, endsAt };
    setForm(next);
    void write(next);
  }

  async function remove() {
    if (!shiftIdRef.current) {
      onClose();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSave({ kind: "saving" });

    const result = await deleteShiftAction({
      id: shiftIdRef.current,
      storeId: week.store.id,
    });
    if (result.kind === "saved") {
      shiftIdRef.current = null;
      onSaved();
      onClose();
      return;
    }
    setSave({ kind: "error", message: "Passet kunde inte tas bort." });
  }

  async function markFree() {
    if (timer.current) clearTimeout(timer.current);
    setSave({ kind: "saving" });

    const result = await clearDayAction({
      storeId: week.store.id,
      employeeId: editing.employeeId,
      date: editing.date,
    });
    if (result.kind === "saved") {
      onSaved();
      onClose();
      return;
    }
    setSave({ kind: "error", message: "Dagen kunde inte rensas." });
  }

  const hasShift = shiftIdRef.current !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Stäng"
        onClick={onClose}
        className="absolute inset-0 bg-scrim"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {editing.employeeName}
            </h2>
            <p className="text-sm capitalize text-muted">{formatLongDateString(editing.date)}</p>
            <p className="text-sm text-muted">{coverageLine(day)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-tap shrink-0 rounded-xl px-3 text-sm text-muted transition hover:text-ink"
          >
            Klar
          </button>
        </div>

        {day.templates.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium">Färdiga pass</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {day.templates.map((template) => {
                const selected =
                  form.startsAt === template.startsAt && form.endsAt === template.endsAt;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.startsAt, template.endsAt)}
                    aria-pressed={selected}
                    className={`min-h-tap rounded-full border px-4 text-sm transition ${
                      selected
                        ? "border-primary bg-raised font-semibold ring-1 ring-primary"
                        : "border-control bg-surface font-medium hover:border-primary"
                    }`}
                  >
                    {template.label}
                    <span className="ml-1 tabular-nums text-muted">
                      {compactTime(template.startsAt)}–{compactTime(template.endsAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="block font-medium">Från</span>
            <input
              type="time"
              value={form.startsAt}
              onChange={(event) => change({ startsAt: event.target.value })}
              className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
            />
          </label>
          <label className="block text-sm">
            <span className="block font-medium">Till</span>
            <input
              type="time"
              value={form.endsAt}
              onChange={(event) => change({ endsAt: event.target.value })}
              className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3 tabular-nums"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm">
          <span className="block font-medium">Anteckning om passet</span>
          <textarea
            value={form.note}
            onChange={(event) => change({ note: event.target.value })}
            maxLength={MAX_SHIFT_NOTE_LENGTH}
            rows={2}
            placeholder="T.ex. leverans kl 14"
            className="mt-1 w-full rounded-xl border border-control bg-raised px-3 py-2"
          />
          <span className="mt-1 block text-xs text-muted">
            {NO_PERSONAL_DATA_SHORT} Max {MAX_SHIFT_NOTE_LENGTH} tecken.
          </span>
        </label>

        {othersThatDay.length > 0 ? (
          <p className="mt-3 text-xs text-muted">
            {editing.employeeName} har redan{" "}
            {othersThatDay
              .map((other) => formatRange(other.startsAt, other.endsAt))
              .join(" och ")}{" "}
            den dagen.
          </p>
        ) : null}

        {!hasShift ? (
          <button
            type="button"
            onClick={() => applyTemplate(form.startsAt, form.endsAt)}
            className="mt-4 min-h-tap w-full rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99]"
          >
            Lägg in passet
          </button>
        ) : null}

        <SaveStatus state={save} saving={hasShift} />

        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {hasShift ? (
            <button
              type="button"
              onClick={() => void remove()}
              className="min-h-tap rounded-2xl border border-danger px-4 text-sm font-medium text-danger transition hover:bg-raised"
            >
              Ta bort passet
            </button>
          ) : null}

          {day.shifts.some((candidate) => candidate.employeeId === editing.employeeId) ? (
            <button
              type="button"
              onClick={() => void markFree()}
              className="min-h-tap rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
            >
              Markera ledig hela dagen
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function coverageLine(day: WeekDay): string {
  return day.coverageText;
}

/**
 * The save state.
 *
 * Quiet when it worked — a tick and a word, because the point of autosave is
 * not having to think about it. Loud only when it did not, since an unsaved
 * shift is somebody not turning up.
 */
function SaveStatus({ state, saving }: { state: SaveState; saving: boolean }) {
  if (state.kind === "error") {
    return (
      <p role="alert" className="mt-3 rounded-xl border border-danger bg-raised p-3 text-sm text-danger">
        <span className="font-semibold">Inte sparat.</span> {state.message}
      </p>
    );
  }

  if (state.kind === "saving") {
    return (
      <p aria-live="polite" className="mt-3 text-sm text-muted">
        Sparar…
      </p>
    );
  }

  if (state.kind === "saved") {
    return (
      <p aria-live="polite" className="mt-3 text-sm text-muted">
        <span aria-hidden>✓ </span>Sparat
      </p>
    );
  }

  return (
    <p className="mt-3 text-xs text-muted">
      {saving ? "Ändringar sparas automatiskt." : "Välj tider och lägg in passet."}
    </p>
  );
}
