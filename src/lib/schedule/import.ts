import { detectDelimiter, parseDelimited } from "@/lib/csv";

/**
 * A shift as it comes out of a file, before it is matched to a User and Store.
 * Times stay as local wall-clock strings the whole way — converting to an
 * instant and back is how imports quietly move a shift by an hour.
 */
export type ParsedShift = {
  email: string;
  storeName: string;
  /** "2026-09-25" */
  date: string;
  /** "07:30" */
  startTime: string;
  endTime: string;
};

export type ShiftParseResult = {
  shifts: ParsedShift[];
  errors: { line: number; message: string }[];
};

const COLUMN_ALIASES: Record<keyof ParsedShift, string[]> = {
  email: ["email", "e-post", "epost", "employee email", "employee", "anställd", "medarbetare"],
  date: ["date", "datum", "dag"],
  startTime: ["start", "start time", "starttid", "från", "fran", "begin"],
  endTime: ["end", "end time", "sluttid", "slut", "till", "finish"],
  storeName: ["store", "butik", "location", "plats", "enhet"],
};

/** "7:30", "0730", "07.30" -> "07:30". Returns null if it is not a time. */
export function normalizeTime(value: string): string | null {
  const text = value.trim();
  if (!text) return null;

  const withSeparator = text.match(/^(\d{1,2})[:.](\d{2})/);
  if (withSeparator) {
    return clampTime(Number(withSeparator[1]), Number(withSeparator[2]));
  }

  const compact = text.match(/^(\d{2})(\d{2})$/);
  if (compact) return clampTime(Number(compact[1]), Number(compact[2]));

  return null;
}

function clampTime(hours: number, minutes: number): string | null {
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Accepts 2026-09-25, 25/09/2026 and 20260925. */
export function normalizeDate(value: string): string | null {
  const text = value.trim();

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validDate(iso[1], iso[2], iso[3]);

  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return validDate(compact[1], compact[2], compact[3]);

  const swedish = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (swedish) {
    return validDate(swedish[3], swedish[2].padStart(2, "0"), swedish[1].padStart(2, "0"));
  }

  return null;
}

function validDate(year: string, month: string, day: string): string | null {
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Rejects 2026-02-31, which Date would otherwise roll into March.
  if (date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

/** Midnight UTC for a "YYYY-MM-DD", so a day is one value to group by. */
export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseShiftCsv(text: string): ShiftParseResult {
  const rows = parseDelimited(text, detectDelimiter(text));
  const errors: ShiftParseResult["errors"] = [];
  const shifts: ParsedShift[] = [];

  if (rows.length === 0) {
    return { shifts, errors: [{ line: 0, message: "Filen är tom." }] };
  }

  const index = mapColumns(rows[0]);
  const missing = (Object.keys(COLUMN_ALIASES) as (keyof ParsedShift)[]).filter(
    (key) => index[key] === undefined
  );
  if (missing.length > 0) {
    return {
      shifts,
      errors: [{ line: 1, message: `Saknar kolumn(er): ${missing.join(", ")}.` }],
    };
  }

  for (let row = 1; row < rows.length; row += 1) {
    const record = rows[row];
    const line = row + 1;
    if (record.every((value) => !value.trim())) continue;

    const email = cell(record, index.email).toLowerCase();
    const storeName = cell(record, index.storeName);
    const date = normalizeDate(cell(record, index.date));
    const startTime = normalizeTime(cell(record, index.startTime));
    const endTime = normalizeTime(cell(record, index.endTime));

    if (!email) {
      errors.push({ line, message: "Rad utan e-post." });
      continue;
    }
    if (!date) {
      errors.push({ line, message: `Ogiltigt datum "${cell(record, index.date)}" (${email}).` });
      continue;
    }
    if (!startTime || !endTime) {
      errors.push({ line, message: `Ogiltig tid (${email}, ${date}).` });
      continue;
    }

    shifts.push({ email, storeName, date, startTime, endTime });
  }

  return { shifts, errors };
}

function cell(record: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (record[index] ?? "").trim();
}

function mapColumns(headers: string[]): Partial<Record<keyof ParsedShift, number>> {
  const index: Partial<Record<keyof ParsedShift, number>> = {};
  headers.forEach((header, position) => {
    const normalized = header.trim().toLowerCase().replace(/^﻿/, "");
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (index[field as keyof ParsedShift] === undefined && aliases.includes(normalized)) {
        index[field as keyof ParsedShift] = position;
      }
    }
  });
  return index;
}

// ---------------------------------------------------------------------------
// ICS
// ---------------------------------------------------------------------------

/**
 * Minimal iCalendar reader for shift exports.
 *
 * Deliberately not a general iCalendar implementation — no recurrence, no
 * timezone database. Scheduling exports are flat lists of dated events, and a
 * full RFC 5545 parser would be a lot of surface area for one import path.
 * Anything it cannot read is reported rather than guessed at.
 */
export function parseShiftIcs(text: string): ShiftParseResult {
  const errors: ShiftParseResult["errors"] = [];
  const shifts: ParsedShift[] = [];

  const lines = unfold(text);
  let current: Record<string, string> | null = null;
  let eventStartLine = 0;

  lines.forEach(({ line, number }) => {
    const upper = line.toUpperCase();

    if (upper.startsWith("BEGIN:VEVENT")) {
      current = {};
      eventStartLine = number;
      return;
    }

    if (upper.startsWith("END:VEVENT")) {
      if (current) {
        const parsed = eventToShift(current);
        if ("error" in parsed) errors.push({ line: eventStartLine, message: parsed.error });
        else shifts.push(parsed);
      }
      current = null;
      return;
    }

    if (!current) return;

    const colon = line.indexOf(":");
    if (colon < 0) return;

    // "DTSTART;TZID=Europe/Stockholm" -> name DTSTART, params kept for the date.
    const rawName = line.slice(0, colon);
    const name = rawName.split(";")[0].toUpperCase();
    const value = line.slice(colon + 1).trim();

    if (name === "ATTENDEE" || name === "ORGANIZER") {
      const mail = `${rawName}:${value}`.match(/mailto:([^\s;:]+)/i);
      if (mail && !current.EMAIL) current.EMAIL = mail[1].toLowerCase();
      return;
    }

    current[name] = value;
  });

  if (shifts.length === 0 && errors.length === 0) {
    errors.push({ line: 0, message: "Hittade inga VEVENT-poster i filen." });
  }

  return { shifts, errors };
}

function eventToShift(event: Record<string, string>): ParsedShift | { error: string } {
  const start = parseIcsDateTime(event.DTSTART);
  const end = parseIcsDateTime(event.DTEND);

  if (!start) return { error: `VEVENT utan giltig DTSTART (${event.SUMMARY ?? "utan titel"}).` };
  if (!end) return { error: `VEVENT utan giltig DTEND (${event.SUMMARY ?? "utan titel"}).` };

  // Email can be on ATTENDEE, or written into the description/summary.
  const email =
    event.EMAIL ??
    `${event.DESCRIPTION ?? ""} ${event.SUMMARY ?? ""}`
      .match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]
      ?.toLowerCase();

  if (!email) {
    return { error: `VEVENT utan e-post (${event.SUMMARY ?? "utan titel"}).` };
  }

  return {
    email,
    storeName: event.LOCATION ?? "",
    date: start.date,
    startTime: start.time,
    endTime: end.time,
  };
}

/** "20260925T073000", with or without a trailing Z or a TZID parameter. */
function parseIcsDateTime(value: string | undefined): { date: string; time: string } | null {
  if (!value) return null;

  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?$/);
  if (!match) return null;

  const date = validDate(match[1], match[2], match[3]);
  if (!date) return null;

  const time = match[4] ? clampTime(Number(match[4]), Number(match[5])) : "00:00";
  return time ? { date, time } : null;
}

/** RFC 5545 folds long lines; a continuation starts with a space or tab. */
function unfold(text: string): { line: string; number: number }[] {
  const out: { line: string; number: number }[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    if (/^[ \t]/.test(raw) && out.length > 0) {
      out[out.length - 1].line += raw.slice(1);
      return;
    }
    out.push({ line: raw, number: index + 1 });
  });

  return out;
}
