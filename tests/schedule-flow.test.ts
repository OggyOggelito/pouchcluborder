import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

/** Throwaway database — never the project's dev.db. */
const dir = mkdtempSync(path.join(tmpdir(), "pc-schedule-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;

let prisma: typeof import("../src/lib/db").prisma;
let week: typeof import("../src/lib/repositories/schedule-week");
let extra: typeof import("../src/lib/repositories/extra-shifts");
let availability: typeof import("../src/lib/repositories/availability");
let hours: typeof import("../src/lib/repositories/opening-hours");
let nearby: typeof import("../src/lib/repositories/nearby");

before(async () => {
  execFileSync("npx", ["prisma", "db", "push"], {
    env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
    stdio: "pipe",
  });
  ({ prisma } = await import("../src/lib/db"));
  week = await import("../src/lib/repositories/schedule-week");
  extra = await import("../src/lib/repositories/extra-shifts");
  availability = await import("../src/lib/repositories/availability");
  hours = await import("../src/lib/repositories/opening-hours");
  nearby = await import("../src/lib/repositories/nearby");
});

after(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

let counter = 0;

/** Two stores in one region, one employee each, and one manager account. */
async function fixture(options: { openToExtraShifts?: boolean } = {}) {
  const suffix = `${Date.now()}-${counter++}`;

  const [asking, home] = await Promise.all([
    prisma.store.create({
      data: { name: `Frågande ${suffix}`, slug: `ask-${suffix}`, region: `R-${suffix}` },
      select: { id: true, name: true },
    }),
    prisma.store.create({
      data: { name: `Hem ${suffix}`, slug: `home-${suffix}`, region: `R-${suffix}` },
      select: { id: true, name: true },
    }),
  ]);

  const user = await prisma.user.create({
    data: { email: `u-${suffix}@example.test`, hashedPassword: "x", role: "OWNER" },
    select: { id: true },
  });

  const [theirs, ours] = await Promise.all([
    prisma.employee.create({
      data: {
        name: `Alva ${suffix}`,
        homeStoreId: home.id,
        openToExtraShifts: options.openToExtraShifts ?? true,
      },
      select: { id: true, name: true },
    }),
    prisma.employee.create({
      data: { name: `Bosse ${suffix}`, homeStoreId: asking.id },
      select: { id: true, name: true },
    }),
  ]);

  // Monday to Friday 10–20, Saturday 10–18, closed Sunday.
  for (const weekday of [1, 2, 3, 4, 5]) {
    await hours.saveWeekday({
      storeId: asking.id,
      weekday,
      opensAt: "10:00",
      closesAt: "20:00",
      closed: false,
    });
  }
  await hours.saveWeekday({
    storeId: asking.id,
    weekday: 6,
    opensAt: "10:00",
    closesAt: "18:00",
    closed: false,
  });
  await hours.saveWeekday({
    storeId: asking.id,
    weekday: 7,
    opensAt: "10:00",
    closesAt: "18:00",
    closed: true,
  });

  return { asking, home, user, theirs, ours };
}

describe("entering a week", () => {
  it("saves a shift, logs who did it and shows it in the grid", async () => {
    const { asking, user, ours } = await fixture();

    await week.saveShift({
      storeId: asking.id,
      employeeId: ours.id,
      date: "2026-11-04",
      startsAt: "10:00",
      endsAt: "20:00",
      note: "Leverans 14",
      userId: user.id,
    });

    const grid = await week.getWeek({ storeId: asking.id, date: "2026-11-06" });
    assert.ok(grid);
    assert.equal(grid.monday, "2026-11-02");
    assert.equal(grid.weekKey, "2026-W45");

    const wednesday = grid.days.find((day) => day.date === "2026-11-04")!;
    assert.equal(wednesday.shifts.length, 1);
    assert.equal(wednesday.shifts[0].note, "Leverans 14");
    assert.deepEqual(wednesday.coverage.gaps, [], "10–20 covers 10–20");
    assert.ok(grid.changes.some((change) => change.type === "CREATED"));
    assert.ok(grid.changes[0].byName, "the trail has to say who did it");
  });

  it("treats a second save at the same start time as an edit, not an error", async () => {
    const { asking, user, ours } = await fixture();
    const shift = {
      storeId: asking.id,
      employeeId: ours.id,
      date: "2026-11-04",
      startsAt: "10:00",
      note: null,
      userId: user.id,
    };

    const first = await week.saveShift({ ...shift, endsAt: "18:00" });
    const second = await week.saveShift({ ...shift, endsAt: "20:00" });

    assert.equal(first.id, second.id);
    const grid = await week.getWeek({ storeId: asking.id, date: "2026-11-04" });
    const wednesday = grid!.days.find((day) => day.date === "2026-11-04")!;
    assert.equal(wednesday.shifts.length, 1);
    assert.equal(wednesday.shifts[0].endsAt, "20:00");
  });

  it("refuses an end before its start, and nothing is written", async () => {
    const { asking, user, ours } = await fixture();

    await assert.rejects(
      week.saveShift({
        storeId: asking.id,
        employeeId: ours.id,
        date: "2026-11-04",
        startsAt: "18:00",
        endsAt: "10:00",
        note: null,
        userId: user.id,
      }),
      /efter starttiden/
    );
    assert.equal(await prisma.scheduleShift.count({ where: { storeId: asking.id } }), 0);
  });

  it("will not schedule somebody who has left", async () => {
    const { asking, user, ours } = await fixture();
    await prisma.employee.update({ where: { id: ours.id }, data: { active: false } });

    await assert.rejects(
      week.saveShift({
        storeId: asking.id,
        employeeId: ours.id,
        date: "2026-11-04",
        startsAt: "10:00",
        endsAt: "18:00",
        note: null,
        userId: user.id,
      }),
      /inaktiv/
    );
  });

  it("does not let one store edit or delete another store's shift", async () => {
    const { asking, home, user, ours } = await fixture();

    const { id } = await week.saveShift({
      storeId: asking.id,
      employeeId: ours.id,
      date: "2026-11-04",
      startsAt: "10:00",
      endsAt: "18:00",
      note: null,
      userId: user.id,
    });

    // The other store passes a real shift id. The store scope must refuse it.
    await assert.rejects(
      week.saveShift({
        id,
        storeId: home.id,
        employeeId: ours.id,
        date: "2026-11-05",
        startsAt: "11:00",
        endsAt: "19:00",
        note: null,
        userId: user.id,
      }),
      /finns inte längre/
    );

    await week.deleteShift({ id, storeId: home.id, userId: user.id });
    assert.ok(
      await prisma.scheduleShift.findUnique({ where: { id } }),
      "the shift must survive a delete attempted from the wrong store"
    );

    await week.deleteShift({ id, storeId: asking.id, userId: user.id });
    assert.equal(await prisma.scheduleShift.findUnique({ where: { id } }), null);
  });

  it("marks a day off by removing that person's shifts and nobody else's", async () => {
    const { asking, user, ours } = await fixture();
    const other = await prisma.employee.create({
      data: { name: "Annan", homeStoreId: asking.id },
      select: { id: true },
    });

    for (const employeeId of [ours.id, other.id]) {
      await week.saveShift({
        storeId: asking.id,
        employeeId,
        date: "2026-11-04",
        startsAt: employeeId === ours.id ? "10:00" : "12:00",
        endsAt: "18:00",
        note: null,
        userId: user.id,
      });
    }

    const removed = await week.clearDay({
      storeId: asking.id,
      employeeId: ours.id,
      date: "2026-11-04",
      userId: user.id,
    });

    assert.equal(removed, 1);
    const left = await prisma.scheduleShift.findMany({ where: { storeId: asking.id } });
    assert.deepEqual(left.map((shift) => shift.employeeId), [other.id]);

    // And "ledig" is the absence of a shift — there is no absence row.
    const grid = await week.getWeek({ storeId: asking.id, date: "2026-11-04" });
    assert.ok(grid!.changes.some((change) => change.type === "DAY_OFF"));
  });

  it("puts a day with nobody in it in the warnings, not in the way", async () => {
    const { asking } = await fixture();
    const grid = await week.getWeek({ storeId: asking.id, date: "2026-11-04" });
    const wednesday = grid!.days.find((day) => day.date === "2026-11-04")!;

    assert.ok(wednesday.warnings.some((warning) => warning.kind === "UNSTAFFED"));
    assert.equal(wednesday.coverageText, "Öppet 10–20, ingen bemannad");
  });

  it("resolves a holiday exception into the grid", async () => {
    const { asking } = await fixture();
    await hours.saveException({
      storeId: asking.id,
      date: "2026-11-04",
      closed: true,
      opensAt: null,
      closesAt: null,
      note: "Inventering",
    });

    const grid = await week.getWeek({ storeId: asking.id, date: "2026-11-04" });
    const wednesday = grid!.days.find((day) => day.date === "2026-11-04")!;
    assert.equal(wednesday.hours.closed, true);
    assert.equal(wednesday.hours.note, "Inventering");
    assert.deepEqual(wednesday.templates, [], "a closed day offers no one-tap shift");
  });

  it("refuses an exception that is open but has no hours", async () => {
    const { asking } = await fixture();
    await assert.rejects(
      hours.saveException({
        storeId: asking.id,
        date: "2026-11-04",
        closed: false,
        opensAt: null,
        closesAt: null,
        note: null,
      }),
      /needs both times/
    );
  });

  it("only deletes an exception belonging to the store that asks", async () => {
    const { asking, home } = await fixture();
    await hours.saveException({
      storeId: asking.id,
      date: "2026-12-24",
      closed: true,
      opensAt: null,
      closesAt: null,
      note: "Julafton",
    });
    const [exception] = await hours.listExceptions(asking.id);

    await hours.deleteException(home.id, exception.id);
    assert.equal((await hours.listExceptions(asking.id)).length, 1, "wrong store must not delete it");

    await hours.deleteException(asking.id, exception.id);
    assert.equal((await hours.listExceptions(asking.id)).length, 0);
  });
});

describe("copy week", () => {
  async function weekOfShifts() {
    const { asking, user, ours } = await fixture();
    const second = await prisma.employee.create({
      data: { name: "Cilla", homeStoreId: asking.id },
      select: { id: true },
    });

    // Week 44: Wednesday and Thursday.
    await week.saveShift({
      storeId: asking.id,
      employeeId: ours.id,
      date: "2026-10-28",
      startsAt: "10:00",
      endsAt: "20:00",
      note: "Leverans",
      userId: user.id,
    });
    await week.saveShift({
      storeId: asking.id,
      employeeId: second.id,
      date: "2026-10-29",
      startsAt: "10:00",
      endsAt: "18:00",
      note: null,
      userId: user.id,
    });

    return { asking, user, ours, second };
  }

  it("previews before it writes anything", async () => {
    const { asking } = await weekOfShifts();

    const plan = await week.previewCopyWeek({
      storeId: asking.id,
      sourceDate: "2026-10-28",
      targetDate: "2026-11-04",
    });

    assert.deepEqual(
      plan.create.map((candidate) => [candidate.date, candidate.startsAt]),
      [
        ["2026-11-04", "10:00"],
        ["2026-11-05", "10:00"],
      ]
    );
    assert.equal(
      await prisma.scheduleShift.count({ where: { storeId: asking.id, date: { gte: "2026-11-02" } } }),
      0,
      "a preview writes nothing"
    );
  });

  it("applies the plan and keeps the notes", async () => {
    const { asking, user } = await weekOfShifts();

    const result = await week.applyCopy({
      storeId: asking.id,
      sourceDate: "2026-10-28",
      targetDate: "2026-11-04",
      scope: "week",
      userId: user.id,
    });

    assert.deepEqual(result, { created: 2, skipped: 0 });
    const copied = await prisma.scheduleShift.findMany({
      where: { storeId: asking.id, date: { gte: "2026-11-02", lte: "2026-11-08" } },
      orderBy: { date: "asc" },
    });
    assert.deepEqual(copied.map((shift) => shift.date), ["2026-11-04", "2026-11-05"]);
    assert.equal(copied[0].note, "Leverans");
  });

  it("is safe to run twice — the second run overwrites nothing", async () => {
    const { asking, user } = await weekOfShifts();
    const copy = {
      storeId: asking.id,
      sourceDate: "2026-10-28",
      targetDate: "2026-11-04",
      scope: "week" as const,
      userId: user.id,
    };

    await week.applyCopy(copy);
    const second = await week.applyCopy(copy);

    assert.deepEqual(second, { created: 0, skipped: 2 });
    assert.equal(
      await prisma.scheduleShift.count({
        where: { storeId: asking.id, date: { gte: "2026-11-02", lte: "2026-11-08" } },
      }),
      2
    );
  });

  it("copies a single day", async () => {
    const { asking, user } = await weekOfShifts();

    const result = await week.applyCopy({
      storeId: asking.id,
      sourceDate: "2026-10-28",
      targetDate: "2026-10-30",
      scope: "day",
      userId: user.id,
    });

    assert.equal(result.created, 1);
    const friday = await prisma.scheduleShift.findMany({
      where: { storeId: asking.id, date: "2026-10-30" },
    });
    assert.equal(friday.length, 1);
    assert.equal(friday[0].startsAt, "10:00");
  });

  it("logs the copy against the week it landed in", async () => {
    const { asking, user } = await weekOfShifts();
    await week.applyCopy({
      storeId: asking.id,
      sourceDate: "2026-10-28",
      targetDate: "2026-11-04",
      scope: "week",
      userId: user.id,
    });

    const grid = await week.getWeek({ storeId: asking.id, date: "2026-11-04" });
    assert.ok(grid!.changes.some((change) => change.type === "COPIED_WEEK"));
  });
});

describe("extra shifts", () => {
  it("runs the whole flow: ask, accept, shift appears at the asking store", async () => {
    const { asking, home, user, theirs } = await fixture();

    const requestId = await extra.createRequest({
      requestingStoreId: asking.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "10:00",
      endsAt: "18:00",
      note: "Lagerdag",
      createdById: user.id,
    });

    const asked = await extra.getRequest(requestId);
    assert.equal(asked!.status, "REQUESTED");
    assert.deepEqual(asked!.events.map((event) => event.type), ["CREATED"]);

    const { shiftId } = await extra.acceptRequest({
      requestId,
      userId: user.id,
      decidingStoreName: home.name,
    });

    const accepted = await extra.getRequest(requestId);
    assert.equal(accepted!.status, "ACCEPTED");
    assert.equal(accepted!.shiftId, shiftId);
    assert.deepEqual(accepted!.events.map((event) => event.type), ["CREATED", "ACCEPTED"]);

    const shift = await prisma.scheduleShift.findUnique({ where: { id: shiftId } });
    assert.equal(shift!.storeId, asking.id, "the work happens at the asking store");
    assert.equal(shift!.extraShiftRequestId, requestId, "and is marked as an extra shift");

    // It shows up on the asking store's grid as a borrowed row.
    const grid = await week.getWeek({ storeId: asking.id, date: "2026-11-07" });
    const borrowed = grid!.employees.find((employee) => employee.id === theirs.id);
    assert.ok(borrowed, "a borrowed colleague has to appear on the grid");
    assert.equal(borrowed.own, false);
    assert.equal(borrowed.homeStoreName, home.name);
    assert.equal(grid!.days.find((day) => day.date === "2026-11-07")!.shifts[0].isExtra, true);
  });

  it("removes the employee from availability for that time once accepted", async () => {
    const { asking, home, user, theirs } = await fixture();
    const window = { date: "2026-11-07", startsAt: "10:00", endsAt: "18:00" };

    const before = await availability.getAvailability({
      requestingStoreId: asking.id,
      ...window,
      seesAllStores: false,
    });
    assert.deepEqual(before.rows.map((row) => row.employeeId), [theirs.id]);

    const requestId = await extra.createRequest({
      requestingStoreId: asking.id,
      employeeId: theirs.id,
      ...window,
      note: null,
      createdById: user.id,
    });
    await extra.acceptRequest({ requestId, userId: user.id, decidingStoreName: home.name });

    const after = await availability.getAvailability({
      requestingStoreId: asking.id,
      ...window,
      seesAllStores: false,
    });
    assert.deepEqual(after.rows, [], "an accepted extra shift is a shift like any other");

    // But a window that misses it is still free.
    const evening = await availability.getAvailability({
      requestingStoreId: asking.id,
      date: "2026-11-07",
      startsAt: "18:00",
      endsAt: "20:00",
      seesAllStores: false,
    });
    assert.deepEqual(evening.rows.map((row) => row.employeeId), [theirs.id]);
  });

  it("refuses to double book, and leaves the request answerable", async () => {
    const { asking, home, user, theirs } = await fixture();

    const requestId = await extra.createRequest({
      requestingStoreId: asking.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "10:00",
      endsAt: "18:00",
      note: null,
      createdById: user.id,
    });

    // Their own store rotas them in the meantime.
    await week.saveShift({
      storeId: home.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "12:00",
      endsAt: "20:00",
      note: null,
      userId: user.id,
    });

    await assert.rejects(
      extra.acceptRequest({ requestId, userId: user.id, decidingStoreName: home.name }),
      (error: Error) => error instanceof extra.DoubleBookedError
    );

    // The whole transaction rolled back: no shift, and the status is untouched.
    const unchanged = await extra.getRequest(requestId);
    assert.equal(unchanged!.status, "REQUESTED");
    assert.equal(unchanged!.shiftId, null);
    assert.equal(
      await prisma.scheduleShift.count({ where: { storeId: asking.id, date: "2026-11-07" } }),
      0
    );
  });

  it("lets a non-overlapping shift elsewhere through", async () => {
    const { asking, home, user, theirs } = await fixture();

    await week.saveShift({
      storeId: home.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "10:00",
      endsAt: "14:00",
      note: null,
      userId: user.id,
    });

    const requestId = await extra.createRequest({
      requestingStoreId: asking.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "14:00",
      endsAt: "18:00",
      note: null,
      createdById: user.id,
    });

    const { shiftId } = await extra.acceptRequest({
      requestId,
      userId: user.id,
      decidingStoreName: home.name,
    });
    assert.ok(shiftId, "a handover at 14:00 is not a double booking");
  });

  it("lets exactly one answer land when two arrive at once", async () => {
    const { asking, home, user, theirs } = await fixture();

    const requestId = await extra.createRequest({
      requestingStoreId: asking.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "10:00",
      endsAt: "18:00",
      note: null,
      createdById: user.id,
    });

    const results = await Promise.allSettled([
      extra.acceptRequest({ requestId, userId: user.id, decidingStoreName: home.name }),
      extra.answerRequest({ requestId, to: "DECLINED", userId: user.id }),
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
      "accept and decline at the same moment must not both land"
    );

    const answered = await extra.getRequest(requestId);
    assert.ok(["ACCEPTED", "DECLINED"].includes(answered!.status));
    assert.equal(
      await prisma.scheduleShift.count({ where: { storeId: asking.id, date: "2026-11-07" } }),
      answered!.status === "ACCEPTED" ? 1 : 0,
      "a declined request must not have created a shift"
    );
  });

  it("will not answer a request twice", async () => {
    const { asking, home, user, theirs } = await fixture();

    const requestId = await extra.createRequest({
      requestingStoreId: asking.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "10:00",
      endsAt: "18:00",
      note: null,
      createdById: user.id,
    });

    await extra.answerRequest({ requestId, to: "DECLINED", userId: user.id });

    await assert.rejects(
      extra.acceptRequest({ requestId, userId: user.id, decidingStoreName: home.name }),
      (error: Error) => error instanceof extra.AlreadyAnsweredError
    );
    await assert.rejects(
      extra.answerRequest({ requestId, to: "CANCELLED", userId: user.id }),
      (error: Error) => error instanceof extra.AlreadyAnsweredError
    );
  });

  it("will not ask about somebody who has not agreed to extra shifts", async () => {
    const { asking, user, theirs } = await fixture({ openToExtraShifts: false });

    await assert.rejects(
      extra.createRequest({
        requestingStoreId: asking.id,
        employeeId: theirs.id,
        date: "2026-11-07",
        startsAt: "10:00",
        endsAt: "18:00",
        note: null,
        createdById: user.id,
      }),
      /inte öppen för extrapass/
    );
  });

  it("will not ask for its own staff, or ask twice for the same day", async () => {
    const { asking, user, ours, theirs } = await fixture();

    await assert.rejects(
      extra.createRequest({
        requestingStoreId: asking.id,
        employeeId: ours.id,
        date: "2026-11-07",
        startsAt: "10:00",
        endsAt: "18:00",
        note: null,
        createdById: user.id,
      }),
      /hör redan till butiken/
    );

    const ask = {
      requestingStoreId: asking.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "10:00",
      endsAt: "18:00",
      note: null,
      createdById: user.id,
    };
    await extra.createRequest(ask);
    await assert.rejects(extra.createRequest(ask), /redan skickad/);
  });

  it("files requests under the right tab for each side", async () => {
    const { asking, home, user, theirs } = await fixture();

    const requestId = await extra.createRequest({
      requestingStoreId: asking.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "10:00",
      endsAt: "18:00",
      note: null,
      createdById: user.id,
    });

    const homeIncoming = await extra.listRequests({ storeIds: [home.id], tab: "incoming" });
    assert.deepEqual(homeIncoming.map((row) => row.id), [requestId], "the home store decides");
    assert.deepEqual(await extra.listRequests({ storeIds: [home.id], tab: "outgoing" }), []);

    const askingOutgoing = await extra.listRequests({ storeIds: [asking.id], tab: "outgoing" });
    assert.deepEqual(askingOutgoing.map((row) => row.id), [requestId]);
    assert.deepEqual(await extra.listRequests({ storeIds: [asking.id], tab: "incoming" }), []);

    assert.equal(await extra.countIncomingRequests([home.id]), 1);
    assert.equal(await extra.countIncomingRequests([asking.id]), 0);

    await extra.answerRequest({ requestId, to: "DECLINED", userId: user.id });
    for (const storeId of [home.id, asking.id]) {
      assert.deepEqual(
        (await extra.listRequests({ storeIds: [storeId], tab: "history" })).map((row) => row.id),
        [requestId],
        "both sides keep the answered request in their history"
      );
      assert.deepEqual(await extra.listRequests({ storeIds: [storeId], tab: "incoming" }), []);
    }
  });

  it("gives a store with no access nothing at all", async () => {
    const { asking, user, theirs } = await fixture();
    await extra.createRequest({
      requestingStoreId: asking.id,
      employeeId: theirs.id,
      date: "2026-11-07",
      startsAt: "10:00",
      endsAt: "18:00",
      note: null,
      createdById: user.id,
    });

    for (const tab of ["incoming", "outgoing", "history"] as const) {
      assert.deepEqual(await extra.listRequests({ storeIds: [], tab }), []);
    }
  });
});

describe("who can see whom", () => {
  it("uses the region until an admin configures pairs", async () => {
    const { asking, home, theirs } = await fixture();

    const byRegion = await availability.getAvailability({
      requestingStoreId: asking.id,
      date: "2026-11-07",
      seesAllStores: false,
    });
    assert.equal(byRegion.fromRegion, true);
    assert.deepEqual(byRegion.rows.map((row) => row.employeeId), [theirs.id]);
    assert.deepEqual(byRegion.searchedStores.map((store) => store.id), [home.id]);

    // An admin links two unrelated stores. The region stops deciding, and the
    // two stores that were nearby by region no longer are.
    const [a, b] = await Promise.all([
      prisma.store.create({ data: { name: `X ${counter}`, slug: `x-${counter++}` }, select: { id: true } }),
      prisma.store.create({ data: { name: `Y ${counter}`, slug: `y-${counter++}` }, select: { id: true } }),
    ]);
    await nearby.linkStores(a.id, b.id);

    const configured = await availability.getAvailability({
      requestingStoreId: asking.id,
      date: "2026-11-07",
      seesAllStores: false,
    });
    assert.equal(configured.fromRegion, false);
    assert.deepEqual(configured.rows, []);
    assert.deepEqual(configured.searchedStores, []);

    // Linking works both ways and unlinking removes both rows.
    assert.deepEqual(await nearby.nearbyFor(a.id), [b.id]);
    assert.deepEqual(await nearby.nearbyFor(b.id), [a.id]);
    await nearby.unlinkStores(a.id, b.id);
    assert.deepEqual(await nearby.listNearbyPairs(), []);
  });

  it("does not limit an admin to the nearby setting", async () => {
    const { asking, theirs } = await fixture();
    const [a, b] = await Promise.all([
      prisma.store.create({ data: { name: `P ${counter}`, slug: `p-${counter++}` }, select: { id: true } }),
      prisma.store.create({ data: { name: `Q ${counter}`, slug: `q-${counter++}` }, select: { id: true } }),
    ]);
    await nearby.linkStores(a.id, b.id);

    const asOwner = await availability.getAvailability({
      requestingStoreId: asking.id,
      date: "2026-11-07",
      seesAllStores: false,
    });
    assert.deepEqual(asOwner.rows, []);

    const asAdmin = await availability.getAvailability({
      requestingStoreId: asking.id,
      date: "2026-11-07",
      seesAllStores: true,
    });
    assert.ok(asAdmin.rows.some((row) => row.employeeId === theirs.id));

    await nearby.unlinkStores(a.id, b.id);
  });
});
