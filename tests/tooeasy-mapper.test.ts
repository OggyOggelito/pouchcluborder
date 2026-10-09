import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calendarDate,
  expFromJwt,
  hasUtcOffset,
  mapShiftsResponse,
  parseTokenResponse,
  stripEmployeeRows,
  suggestMatch,
  toDateWindow,
  wallClock,
} from "../src/lib/schedule/tooeasy-mapper";
import {
  EMPLOYEE_B,
  OUR_STORE,
  OUR_USER_A,
  STORE_UNMAPPED,
  maps,
  shiftsAcrossDst,
  shiftsAcrossStores,
  shiftsUnknownEmployee,
  shiftsWithPayroll,
  shiftsWithUtcOffset,
} from "./fixtures";

/** A JWT with a known `exp`. Signature is irrelevant — we never verify it. */
function jwtWithExp(expSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");
  return `header.${body}.signature`;
}

describe("token handling", () => {
  it("reads the common field names", () => {
    for (const field of ["token", "access_token", "accessToken", "Token", "jwt"]) {
      const parsed = parseTokenResponse(JSON.stringify({ [field]: "abc.def.ghi" }));
      assert.equal(parsed?.token, "abc.def.ghi", `field ${field}`);
      assert.equal(parsed?.field, field);
    }
  });

  it("accepts a bare string body", () => {
    assert.equal(parseTokenResponse('"abc.def.ghi"')?.token, "abc.def.ghi");
    assert.equal(parseTokenResponse("abc.def.ghi")?.token, "abc.def.ghi");
  });

  it("strips a Bearer prefix returned inside the field", () => {
    assert.equal(parseTokenResponse(JSON.stringify({ token: "Bearer abc.def" }))?.token, "abc.def");
  });

  it("returns null for junk rather than inventing a token", () => {
    assert.equal(parseTokenResponse(""), null);
    assert.equal(parseTokenResponse("{not json"), null);
    assert.equal(parseTokenResponse(JSON.stringify({ unexpected: 1 })), null);
  });

  it("decodes exp from the JWT when no expiry field is present", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const parsed = parseTokenResponse(JSON.stringify({ token: jwtWithExp(exp) }));
    assert.equal(parsed?.expiresAt, exp * 1000);
  });

  it("prefers an explicit expires_in lifetime in seconds", () => {
    const now = 1_700_000_000_000;
    const parsed = parseTokenResponse(
      JSON.stringify({ token: "a.b.c", expires_in: 1800 }),
      now
    );
    assert.equal(parsed?.expiresAt, now + 1_800_000);
  });

  it("reads an absolute expiry timestamp", () => {
    const parsed = parseTokenResponse(
      JSON.stringify({ token: "a.b.c", expiresAt: "2026-10-15T12:00:00Z" })
    );
    assert.equal(parsed?.expiresAt, Date.parse("2026-10-15T12:00:00Z"));
  });

  it("reports no expiry when there is none to find", () => {
    assert.equal(parseTokenResponse(JSON.stringify({ token: "a.b.c" }))?.expiresAt, null);
    assert.equal(expFromJwt("notajwt"), null);
  });
});

describe("date window", () => {
  // Locks in the CURRENT ASSUMPTION: the window is inclusive at both ends, so
  // a 14-day forward range is anchored on its last day and reaches 14 days
  // back. `npm run tooeasy:probe` verifies this against real data; if the API
  // disagrees, change toDateWindow and this test together.
  it("anchors on the end of the range and counts back inclusively", () => {
    const window = toDateWindow(
      new Date("2026-10-09T00:00:00Z"),
      new Date("2026-10-22T00:00:00Z")
    );
    assert.equal(window.startDate, "2026-10-22");
    assert.equal(window.numberOfDaysBack, 14);
  });

  it("treats a single day as one day back", () => {
    const window = toDateWindow(
      new Date("2026-10-09T00:00:00Z"),
      new Date("2026-10-09T00:00:00Z")
    );
    assert.equal(window.startDate, "2026-10-09");
    assert.equal(window.numberOfDaysBack, 1);
  });
});

describe("timezone handling", () => {
  it("slices the literal local time", () => {
    assert.equal(wallClock("2026-10-15T07:30:00"), "07:30");
    assert.equal(wallClock("2026-10-15T23:05:00.000"), "23:05");
  });

  it("keeps the same clock time either side of a DST change", () => {
    const { entries } = mapShiftsResponse(shiftsAcrossDst, maps());
    assert.equal(entries.length, 2);
    // 2026-10-25 is the CEST -> CET change. Both shifts read 07:30 locally and
    // must stay 07:30; converting through an instant would move one of them.
    assert.deepEqual(
      entries.map((entry) => entry.startTime),
      ["07:30", "07:30"]
    );
    assert.deepEqual(
      entries.map((entry) => entry.date.toISOString().slice(0, 10)),
      ["2026-10-24", "2026-10-26"]
    );
  });

  it("rejects values that carry a UTC offset instead of mis-reading them", () => {
    assert.equal(hasUtcOffset("2026-10-15T05:30:00Z"), true);
    assert.equal(hasUtcOffset("2026-10-15T05:30:00+02:00"), true);
    assert.equal(hasUtcOffset("2026-10-15T05:30:00"), false);
    assert.equal(wallClock("2026-10-15T05:30:00Z"), null);

    // A UTC payload yields nothing rather than a shift three hours out.
    const { entries } = mapShiftsResponse(shiftsWithUtcOffset, maps());
    assert.equal(entries.length, 0);
  });

  it("parses the calendar date at midnight UTC", () => {
    assert.equal(calendarDate("2026-10-15T07:30:00")?.toISOString(), "2026-10-15T00:00:00.000Z");
    assert.equal(calendarDate("nonsense"), null);
  });
});

describe("mapping", () => {
  it("maps a shift onto our own ids", () => {
    const { entries } = mapShiftsResponse(shiftsWithPayroll, maps());
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0], {
      userId: OUR_USER_A,
      storeId: OUR_STORE,
      date: new Date("2026-10-15T00:00:00.000Z"),
      startTime: "07:30",
      endTime: "16:00",
    });
  });

  it("skips shifts from an unmapped store and reports it", () => {
    const { entries, unmappedStoreNumbers } = mapShiftsResponse(shiftsAcrossStores, maps());
    assert.equal(entries.length, 1);
    assert.equal(entries[0].storeId, OUR_STORE);
    assert.deepEqual(unmappedStoreNumbers, [STORE_UNMAPPED]);
  });

  it("skips an unmapped employee and reports it", () => {
    const { entries, unmappedEmployeeIds } = mapShiftsResponse(shiftsUnknownEmployee, maps());
    assert.equal(entries.length, 0);
    assert.deepEqual(unmappedEmployeeIds, [EMPLOYEE_B]);
  });

  it("survives empty and malformed payloads", () => {
    for (const payload of [null, undefined, {}, { stores: null }, { stores: [] }]) {
      assert.equal(mapShiftsResponse(payload as never, maps()).entries.length, 0);
    }
  });
});

describe("data minimisation", () => {
  const PAYROLL_FIELDS = ["TotalCost", "OBCost", "PayrollTaxes", "CostExPayrollTax"];

  it("never lets a payroll field reach the output", () => {
    const { entries } = mapShiftsResponse(shiftsWithPayroll, maps());
    assert.ok(entries.length > 0, "fixture must produce a shift for this to mean anything");

    const serialised = JSON.stringify(entries);
    for (const field of PAYROLL_FIELDS) {
      assert.ok(!serialised.includes(field), `${field} leaked into ShiftEntry`);
    }

    // And by value, in case a field were ever renamed on the way through.
    for (const value of [2345.5, 120.25, 540.1, 1805.4]) {
      assert.ok(!serialised.includes(String(value)), `payroll value ${value} leaked`);
    }

    // ShiftEntry has exactly these keys and nothing else.
    assert.deepEqual(Object.keys(entries[0]).sort(), [
      "date",
      "endTime",
      "startTime",
      "storeId",
      "userId",
    ]);
  });

  it("never lets a personal name reach the output", () => {
    const { entries } = mapShiftsResponse(shiftsWithPayroll, maps());
    const serialised = JSON.stringify(entries);
    for (const field of ["Firstname", "Lastname", "Testa", "Testsson"]) {
      assert.ok(!serialised.includes(field), `${field} leaked into ShiftEntry`);
    }
  });
});

describe("employee directory stripping", () => {
  const rows = [
    {
      EmployeeId: "EMP-0001",
      FirstName: "Testa",
      LastName: "Testsson",
      Inactive: false,
      ProtectedIdentity: false,
      // Fields that must never survive the strip:
      PersonalIdentityNum: "19900101-0000",
      Email: "testa@example.com",
      BankId: "SE123",
    },
    {
      EmployeeId: "EMP-0002",
      FirstName: "Skyddad",
      LastName: "Person",
      ProtectedIdentity: true,
      PersonalIdentityNum: "19850202-0000",
    },
    { EmployeeId: "  ", FirstName: "Ingen", LastName: "Id" },
  ];

  it("keeps only an employee number and a display name", () => {
    const { options } = stripEmployeeRows(rows);
    assert.equal(options.length, 1);
    assert.deepEqual(Object.keys(options[0]).sort(), ["displayName", "employeeId", "inactive"]);
    assert.equal(options[0].employeeId, "EMP-0001");
  });

  it("never carries personnummer or other PII through", () => {
    const serialised = JSON.stringify(stripEmployeeRows(rows).options);
    for (const leak of ["PersonalIdentityNum", "19900101", "BankId", "SE123", "@example.com"]) {
      assert.ok(!serialised.includes(leak), `${leak} leaked out of the directory`);
    }
  });

  it("excludes protected identities entirely, counting them instead", () => {
    const { options, protectedCount } = stripEmployeeRows(rows);
    assert.equal(protectedCount, 1);
    const serialised = JSON.stringify(options);
    assert.ok(!serialised.includes("Skyddad"), "a protected person's name reached the output");
    assert.ok(!serialised.includes("EMP-0002"), "a protected person's id reached the output");
  });

  it("skips rows with no usable employee id", () => {
    assert.ok(!JSON.stringify(stripEmployeeRows(rows).options).includes("Ingen"));
  });
});

describe("match suggestions", () => {
  const options = [
    { employeeId: "EMP-1", displayName: "Åsa Öberg", inactive: false },
    { employeeId: "EMP-2", displayName: "Bo Berg", inactive: false },
    { employeeId: "EMP-3", displayName: "Bo Berg", inactive: false },
  ];

  it("suggests an unambiguous match, folding case and diacritics", () => {
    assert.equal(suggestMatch("asa oberg", options)?.employeeId, "EMP-1");
    assert.equal(suggestMatch("  Åsa   Öberg ", options)?.employeeId, "EMP-1");
  });

  it("refuses to guess when two people share a name", () => {
    assert.equal(suggestMatch("Bo Berg", options), null);
  });

  it("suggests nothing without a name to go on", () => {
    assert.equal(suggestMatch(null, options), null);
    assert.equal(suggestMatch("   ", options), null);
    assert.equal(suggestMatch("Okänd Person", options), null);
  });
});
