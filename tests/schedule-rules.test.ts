import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_BUFFER_MINUTES,
  coverageFor,
  describeCoverage,
  effectiveHoursFor,
  parseBufferMinutes,
  shiftTemplates,
  withinOpeningHours,
  type WeekdayHours,
} from "../src/lib/schedule/opening-hours";
import {
  addDaysToDate,
  isDateString,
  isTimeString,
  isoWeekKey,
  overlaps,
  toMinutes,
  toTimeString,
  weekDates,
  weekStartOf,
  weekdayOf,
} from "../src/lib/schedule/time";
import {
  MAX_SHIFT_NOTE_LENGTH,
  planCopy,
  validateShift,
  warningsForDay,
  weekDateMap,
} from "../src/lib/schedule/week";

/** Täby Centrum's week, from the seeded table. */
const TABY: WeekdayHours[] = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    opensAt: "10:00",
    closesAt: "20:00",
    closed: false,
  })),
  { weekday: 6, opensAt: "10:00", closesAt: "18:00", closed: false },
  { weekday: 7, opensAt: "10:00", closesAt: "18:00", closed: false },
];

/** Linköping, which is shut on Sundays. */
const LINKOPING: WeekdayHours[] = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    opensAt: "10:00",
    closesAt: "19:00",
    closed: false,
  })),
  { weekday: 6, opensAt: "10:00", closesAt: "17:00", closed: false },
  { weekday: 7, opensAt: "10:00", closesAt: "17:00", closed: true },
];

describe("local dates and wall-clock times", () => {
  it("numbers weekdays Monday-first, the way the opening-hours table does", () => {
    // 2026-11-02 is a Monday.
    assert.equal(weekdayOf("2026-11-02"), 1);
    assert.equal(weekdayOf("2026-11-08"), 7);
  });

  it("survives both clock changes, because nothing becomes an instant", () => {
    // Sweden moves to CET on 2026-10-25 and to CEST on 2027-03-28. A shift
    // stored as an instant shifts an hour across these; a string cannot.
    for (const date of ["2026-10-24", "2026-10-25", "2026-10-26", "2027-03-28", "2027-03-29"]) {
      const hours = effectiveHoursFor(date, TABY);
      assert.equal(hours.opensAt, "10:00", `${date} should still open at 10:00`);
      assert.equal(hours.date, date);
    }

    // And the day before the change plus one day is the day of the change —
    // no 23:00 landing back on the previous date.
    assert.equal(addDaysToDate("2026-10-24", 1), "2026-10-25");
    assert.equal(addDaysToDate("2027-03-27", 1), "2027-03-28");
  });

  it("walks a week from its Monday", () => {
    assert.equal(weekStartOf("2026-11-08"), "2026-11-02");
    assert.deepEqual(weekDates("2026-11-02"), [
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("numbers weeks the way a Swedish rota does", () => {
    assert.equal(isoWeekKey("2026-11-04"), "2026-W45");
    // The turn of the year lands in one week for the whole seven days.
    assert.equal(isoWeekKey("2026-12-31"), isoWeekKey("2027-01-01"));
  });

  it("rejects dates and times that only look like dates and times", () => {
    assert.equal(isDateString("2026-02-30"), false, "February has no 30th");
    assert.equal(isDateString("2026-13-01"), false);
    assert.equal(isDateString("2026-2-1"), false, "must be zero-padded");
    assert.equal(isTimeString("24:00"), false, "the day ends at 23:59");
    assert.equal(isTimeString("7:30"), false);
    assert.equal(isTimeString("10:60"), false);
    assert.equal(isTimeString("10:30"), true);
  });

  it("clamps a time to the day rather than wrapping past midnight", () => {
    assert.equal(toTimeString(-30), "00:00");
    assert.equal(toTimeString(24 * 60 + 30), "23:59");
    assert.equal(toTimeString(toMinutes("07:30")), "07:30");
  });
});

describe("overlap rules", () => {
  const morning = { startsAt: "10:00", endsAt: "14:00" };

  it("counts a shared minute as an overlap", () => {
    assert.equal(overlaps(morning, { startsAt: "13:59", endsAt: "18:00" }), true);
    assert.equal(overlaps(morning, { startsAt: "09:00", endsAt: "10:01" }), true);
  });

  it("does not count a handover as an overlap", () => {
    // 10–14 and 14–18 is one shift ending as the next begins. Warning about
    // it would train people to ignore the warnings.
    assert.equal(overlaps(morning, { startsAt: "14:00", endsAt: "18:00" }), false);
    assert.equal(overlaps(morning, { startsAt: "06:00", endsAt: "10:00" }), false);
  });

  it("is symmetric", () => {
    const other = { startsAt: "12:00", endsAt: "16:00" };
    assert.equal(overlaps(morning, other), overlaps(other, morning));
  });

  it("warns per person, not per shop", () => {
    const hours = effectiveHoursFor("2026-11-04", TABY);
    const twoPeople = warningsForDay({
      hours,
      buffer: 30,
      shifts: [
        { id: "1", employeeId: "a", employeeName: "A", startsAt: "10:00", endsAt: "20:00" },
        { id: "2", employeeId: "b", employeeName: "B", startsAt: "12:00", endsAt: "18:00" },
      ],
    });
    assert.equal(
      twoPeople.filter((warning) => warning.kind === "OVERLAP").length,
      0,
      "two people in the shop at once is coverage, not a clash"
    );

    const onePerson = warningsForDay({
      hours,
      buffer: 30,
      shifts: [
        { id: "1", employeeId: "a", employeeName: "Anna", startsAt: "10:00", endsAt: "20:00" },
        { id: "2", employeeId: "a", employeeName: "Anna", startsAt: "12:00", endsAt: "18:00" },
      ],
    });
    const clash = onePerson.find((warning) => warning.kind === "OVERLAP");
    assert.ok(clash, "one person in two places is a clash");
    assert.match(clash.text, /Anna/);
  });
});

describe("opening hours", () => {
  it("resolves the weekday pattern", () => {
    const wednesday = effectiveHoursFor("2026-11-04", TABY);
    assert.deepEqual(
      { closed: wednesday.closed, opensAt: wednesday.opensAt, closesAt: wednesday.closesAt },
      { closed: false, opensAt: "10:00", closesAt: "20:00" }
    );
  });

  it("tells a closed day apart from a day nobody has filled in", () => {
    const sunday = effectiveHoursFor("2026-11-08", LINKOPING);
    assert.equal(sunday.closed, true);
    assert.equal(sunday.source, "weekday");
    assert.equal(describeCoverage(sunday, coverageFor(sunday, [])), "Stängt");

    const unknown = effectiveHoursFor("2026-11-08", []);
    assert.equal(unknown.source, "missing");
    assert.equal(unknown.closed, false, "missing is not closed");
    assert.equal(describeCoverage(unknown, coverageFor(unknown, [])), "Öppettider saknas");
  });

  it("lets an exception close a day or move its hours", () => {
    const closedForTheDay = effectiveHoursFor("2026-12-24", TABY, [
      { date: "2026-12-24", closed: true, opensAt: null, closesAt: null, note: "Julafton" },
    ]);
    assert.equal(closedForTheDay.closed, true);
    assert.equal(closedForTheDay.source, "exception");
    assert.equal(closedForTheDay.note, "Julafton");
    assert.equal(closedForTheDay.opensAt, null, "a shut shop has no hours");

    const shortDay = effectiveHoursFor("2026-12-23", TABY, [
      { date: "2026-12-23", closed: false, opensAt: "10:00", closesAt: "15:00", note: null },
    ]);
    assert.equal(shortDay.closesAt, "15:00");
  });

  it("only applies an exception to its own date", () => {
    const hours = effectiveHoursFor("2026-12-23", TABY, [
      { date: "2026-12-24", closed: true, opensAt: null, closesAt: null, note: null },
    ]);
    assert.equal(hours.closed, false);
    assert.equal(hours.source, "weekday");
  });

  it("allows the buffer either side and warns beyond it", () => {
    const day = effectiveHoursFor("2026-11-04", TABY);

    assert.equal(withinOpeningHours({ startsAt: "09:30", endsAt: "20:30" }, day, 30), true);
    assert.equal(withinOpeningHours({ startsAt: "09:29", endsAt: "20:00" }, day, 30), false);
    assert.equal(withinOpeningHours({ startsAt: "10:00", endsAt: "20:31" }, day, 30), false);

    // A closed day cannot answer the question, so it never says "fine".
    const sunday = effectiveHoursFor("2026-11-08", LINKOPING);
    assert.equal(withinOpeningHours({ startsAt: "12:00", endsAt: "16:00" }, sunday, 30), false);
  });

  it("reads the buffer from config and refuses to be switched off by a big one", () => {
    assert.equal(parseBufferMinutes(undefined), DEFAULT_BUFFER_MINUTES);
    assert.equal(parseBufferMinutes(""), DEFAULT_BUFFER_MINUTES);
    assert.equal(parseBufferMinutes("abc"), DEFAULT_BUFFER_MINUTES);
    assert.equal(parseBufferMinutes("-5"), DEFAULT_BUFFER_MINUTES);
    assert.equal(parseBufferMinutes("0"), 0);
    assert.equal(parseBufferMinutes("45"), 45);
    assert.equal(parseBufferMinutes("9999"), 120);
  });
});

describe("one-tap templates", () => {
  it("builds the day from the store's own hours", () => {
    const templates = shiftTemplates(effectiveHoursFor("2026-11-04", TABY), 30);
    assert.deepEqual(
      templates.map((template) => [template.label, template.startsAt, template.endsAt]),
      [
        ["Hel dag", "10:00", "20:00"],
        ["Öppning", "09:30", "15:00"],
        ["Stängning", "15:00", "20:30"],
      ]
    );
  });

  it("splits an odd day on the half hour", () => {
    const hours: WeekdayHours[] = [
      { weekday: 3, opensAt: "07:00", closesAt: "20:00", closed: false },
    ];
    const [, opening, closing] = shiftTemplates(effectiveHoursFor("2026-11-04", hours), 30);
    assert.equal(opening.endsAt, "13:30");
    assert.equal(closing.startsAt, "13:30");
  });

  it("offers nothing on a closed day or a day with no hours", () => {
    assert.deepEqual(shiftTemplates(effectiveHoursFor("2026-11-08", LINKOPING), 30), []);
    assert.deepEqual(shiftTemplates(effectiveHoursFor("2026-11-08", []), 30), []);
  });
});

describe("coverage and gaps", () => {
  const wednesday = effectiveHoursFor("2026-11-04", TABY);

  it("reports a fully staffed day", () => {
    const coverage = coverageFor(wednesday, [
      { startsAt: "10:00", endsAt: "15:00" },
      { startsAt: "15:00", endsAt: "20:00" },
    ]);
    assert.deepEqual(coverage.gaps, []);
    assert.deepEqual(coverage.staffed, { from: "10:00", to: "20:00" });
    assert.equal(describeCoverage(wednesday, coverage), "Öppet 10–20, bemannat 10–20");
  });

  it("finds a hole in the middle", () => {
    const coverage = coverageFor(wednesday, [
      { startsAt: "10:00", endsAt: "15:00" },
      { startsAt: "17:00", endsAt: "20:00" },
    ]);
    assert.deepEqual(coverage.gaps, [{ from: "15:00", to: "17:00" }]);
    assert.equal(describeCoverage(wednesday, coverage), "Öppet 10–20, lucka 15–17");
  });

  it("does not count time outside opening hours as coverage", () => {
    // Cashing up until 20:30 does not cover the 19:00 hole.
    const coverage = coverageFor(wednesday, [{ startsAt: "10:00", endsAt: "19:00" }]);
    assert.deepEqual(coverage.gaps, [{ from: "19:00", to: "20:00" }]);

    const after = coverageFor(wednesday, [{ startsAt: "20:00", endsAt: "20:30" }]);
    assert.equal(after.staffed, null, "half an hour after closing staffs nothing");
  });

  it("merges overlapping shifts instead of reporting phantom gaps", () => {
    const coverage = coverageFor(wednesday, [
      { startsAt: "10:00", endsAt: "16:00" },
      { startsAt: "12:00", endsAt: "20:00" },
    ]);
    assert.deepEqual(coverage.gaps, []);
  });

  it("has no opinion about a closed day", () => {
    const coverage = coverageFor(effectiveHoursFor("2026-11-08", LINKOPING), []);
    assert.deepEqual(coverage, { open: null, staffed: null, gaps: [] });
  });
});

describe("warnings warn and never block", () => {
  it("says when nobody is in, once", () => {
    const hours = effectiveHoursFor("2026-11-04", TABY);
    const warnings = warningsForDay({ hours, buffer: 30, shifts: [] });

    assert.equal(warnings.filter((warning) => warning.kind === "UNSTAFFED").length, 1);
    assert.equal(
      warnings.filter((warning) => warning.kind === "GAP").length,
      0,
      "an empty day must not also be reported as a whole-day gap"
    );
  });

  it("flags a shift on a closed day but still accepts it", () => {
    const sunday = effectiveHoursFor("2026-11-08", LINKOPING);
    const shift = { employeeId: "a", date: "2026-11-08", startsAt: "12:00", endsAt: "16:00" };

    const warnings = warningsForDay({
      hours: sunday,
      buffer: 30,
      shifts: [{ id: "1", employeeName: "Anna", ...shift }],
    });
    assert.ok(warnings.some((warning) => warning.kind === "CLOSED_DAY"));

    // The validator is the only thing that refuses, and it has no opinion here.
    assert.equal(validateShift(shift).ok, true);
  });

  it("puts the worst thing first, because only the first line gets read", () => {
    const hours = effectiveHoursFor("2026-11-04", TABY);
    const warnings = warningsForDay({
      hours,
      buffer: 30,
      shifts: [
        { id: "1", employeeId: "a", employeeName: "Anna", startsAt: "06:00", endsAt: "10:00" },
        { id: "2", employeeId: "a", employeeName: "Anna", startsAt: "08:00", endsAt: "12:00" },
      ],
    });
    const kinds = warnings.map((warning) => warning.kind);
    assert.ok(kinds.indexOf("GAP") < kinds.indexOf("OUTSIDE_HOURS"));
    assert.ok(kinds.indexOf("OVERLAP") < kinds.indexOf("OUTSIDE_HOURS"));
  });
});

describe("what a shift must be", () => {
  const base = { employeeId: "a", date: "2026-11-04", startsAt: "10:00", endsAt: "18:00" };

  it("accepts a plain shift and trims an empty note to null", () => {
    const result = validateShift({ ...base, note: "   " });
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.note, null);
  });

  it("refuses an end at or before its start", () => {
    for (const endsAt of ["10:00", "09:00"]) {
      const result = validateShift({ ...base, endsAt });
      assert.equal(result.ok, false);
      assert.ok(
        !result.ok && result.errors.some((error) => error.includes("efter starttiden")),
        `${endsAt} should be refused`
      );
    }
  });

  it("refuses a note longer than a note", () => {
    const result = validateShift({ ...base, note: "x".repeat(MAX_SHIFT_NOTE_LENGTH + 1) });
    assert.equal(result.ok, false);
  });

  it("refuses a date that is not a date", () => {
    assert.equal(validateShift({ ...base, date: "4 nov" }).ok, false);
  });
});

describe("copying a week", () => {
  const source = weekDates("2026-10-26");
  const target = weekDates("2026-11-02");
  const dateMap = weekDateMap(source, target);

  const lastWeek = [
    {
      employeeId: "anna",
      employeeName: "Anna",
      date: "2026-10-28",
      startsAt: "10:00",
      endsAt: "18:00",
      note: null,
    },
    {
      employeeId: "bo",
      employeeName: "Bo",
      date: "2026-10-28",
      startsAt: "12:00",
      endsAt: "20:00",
      note: "Leverans",
    },
  ];

  it("moves every shift forward by the same seven days", () => {
    const plan = planCopy({
      source: lastWeek,
      dateMap,
      existing: [],
      schedulableEmployeeIds: ["anna", "bo"],
    });
    assert.equal(plan.create.length, 2);
    assert.ok(plan.create.every((candidate) => candidate.date === "2026-11-04"));
    assert.equal(plan.create[1].note, "Leverans", "the note comes along");
  });

  it("never overwrites what the destination already has", () => {
    const plan = planCopy({
      source: lastWeek,
      dateMap,
      existing: [{ employeeId: "anna", date: "2026-11-04", startsAt: "10:00" }],
      schedulableEmployeeIds: ["anna", "bo"],
    });
    assert.deepEqual(
      plan.create.map((candidate) => candidate.employeeId),
      ["bo"]
    );
    assert.deepEqual(
      plan.skipped.map((skip) => [skip.candidate.employeeId, skip.reason]),
      [["anna", "DUPLICATE"]]
    );
  });

  it("does not resurrect somebody who has left", () => {
    const plan = planCopy({
      source: lastWeek,
      dateMap,
      existing: [],
      schedulableEmployeeIds: ["anna"],
    });
    assert.deepEqual(
      plan.skipped.map((skip) => [skip.candidate.employeeId, skip.reason]),
      [["bo", "INACTIVE"]]
    );
  });

  it("refuses to re-borrow another store's employee", () => {
    const plan = planCopy({
      source: lastWeek,
      dateMap,
      existing: [],
      schedulableEmployeeIds: ["anna", "bo"],
      borrowedEmployeeIds: ["bo"],
    });
    assert.deepEqual(
      plan.create.map((candidate) => candidate.employeeId),
      ["anna"]
    );
    assert.deepEqual(
      plan.skipped.map((skip) => skip.reason),
      ["BORROWED"]
    );
  });

  it("copies onto a closed day, flagged rather than dropped", () => {
    const plan = planCopy({
      source: lastWeek,
      dateMap,
      existing: [],
      closedDates: ["2026-11-04"],
      schedulableEmployeeIds: ["anna", "bo"],
    });
    assert.equal(plan.create.length, 2);
    assert.ok(plan.create.every((candidate) => candidate.onClosedDay));
  });

  it("does not trip over a source week holding the same shift twice", () => {
    const plan = planCopy({
      source: [lastWeek[0], { ...lastWeek[0] }],
      dateMap,
      existing: [],
      schedulableEmployeeIds: ["anna"],
    });
    assert.equal(plan.create.length, 1);
    assert.equal(plan.skipped.length, 1);
  });

  it("drops a source date nothing maps to", () => {
    const plan = planCopy({
      source: lastWeek,
      dateMap: new Map(),
      existing: [],
      schedulableEmployeeIds: ["anna", "bo"],
    });
    assert.deepEqual(plan, { create: [], skipped: [] });
  });
});
