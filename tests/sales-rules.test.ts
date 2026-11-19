import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  byProduct,
  byStore,
  changeRatio,
  formatChange,
  overTime,
  toGranularity,
  topProducts,
  totals,
  type SalesRow,
} from "../src/lib/sales/aggregate";
import { parseDate, parseNumber, parseSalesCsv } from "../src/lib/sales/csv";
import { daysBetween, previousRange, rangeFor, toPeriod } from "../src/lib/sales-periods";

function row(overrides: Partial<SalesRow> & { date: string; quantity: number }): SalesRow {
  return {
    storeId: "taby",
    storeName: "Täby Centrum",
    productId: "p1",
    flavor: "Mango",
    strength: "12mg",
    format: "Slim",
    amount: null,
    ...overrides,
  };
}

describe("the aggregation maths", () => {
  const rows = [
    row({ date: "2026-11-02", quantity: 3, amount: 150 }),
    row({ date: "2026-11-02", quantity: 2, amount: 100, productId: "p2", flavor: "Mint" }),
    row({ date: "2026-11-09", quantity: 5, amount: 250, storeId: "lkp", storeName: "Linköping" }),
  ];

  it("adds up what is there", () => {
    const summary = totals(rows);
    assert.equal(summary.quantity, 10);
    assert.equal(summary.amount, 500);
    assert.equal(summary.days, 2);
    assert.equal(summary.products, 2);
    assert.equal(summary.stores, 2);
  });

  it("treats a missing amount as unknown, never as zero", () => {
    // A provider that reports units but no money is still useful. A 0 kr next
    // to 40 sold cans would be a lie, so the sum says "partial" instead.
    const mixed = [...rows, row({ date: "2026-11-10", quantity: 4, amount: null })];
    const summary = totals(mixed);
    assert.equal(summary.quantity, 14);
    assert.equal(summary.amount, 500, "the known amounts still add up");
    assert.equal(summary.amountPartial, true);

    const noneAtAll = totals([row({ date: "2026-11-10", quantity: 4 })]);
    assert.equal(noneAtAll.amount, null, "nothing reported means no figure, not 0");
    assert.equal(noneAtAll.amountPartial, false);
  });

  it("buckets by day, ISO week and month", () => {
    assert.deepEqual(
      overTime(rows, "day").map((bucket) => [bucket.key, bucket.quantity]),
      [
        ["2026-11-02", 5],
        ["2026-11-09", 5],
      ]
    );
    assert.deepEqual(
      overTime(rows, "week").map((bucket) => [bucket.label, bucket.quantity]),
      [
        ["v. 45", 5],
        ["v. 46", 5],
      ]
    );
    assert.deepEqual(
      overTime(rows, "month").map((bucket) => [bucket.label, bucket.quantity]),
      [["nov 2026", 10]]
    );
  });

  it("keeps the buckets in time order whatever order the rows arrive in", () => {
    const shuffled = [...rows].reverse();
    assert.deepEqual(
      overTime(shuffled, "day").map((bucket) => bucket.key),
      ["2026-11-02", "2026-11-09"]
    );
  });

  it("ranks products and stores biggest first", () => {
    assert.deepEqual(
      byProduct(rows).map((bucket) => [bucket.label, bucket.quantity]),
      [
        ["Mango 12mg Slim", 8],
        ["Mint 12mg Slim", 2],
      ]
    );
    assert.deepEqual(
      byStore(rows).map((bucket) => [bucket.label, bucket.quantity]),
      [
        ["Linköping", 5],
        ["Täby Centrum", 5],
      ]
    );
    assert.equal(topProducts(rows, 1).length, 1);
  });

  it("has no opinion about an empty period", () => {
    const summary = totals([]);
    assert.deepEqual(
      [summary.quantity, summary.amount, summary.days],
      [0, null, 0]
    );
    assert.deepEqual(overTime([], "day"), []);
  });

  it("refuses to invent a percentage out of nothing", () => {
    assert.equal(changeRatio(10, 0), null, "+∞ % is not a figure");
    assert.equal(formatChange(null), "—");
    assert.equal(formatChange(0.12), "+12 %");
    assert.equal(formatChange(-0.04), "−4 %");
    assert.equal(formatChange(0), "0 %");
  });

  it("falls back to a day grain for anything unrecognised", () => {
    assert.equal(toGranularity("week"), "week");
    assert.equal(toGranularity("decade"), "day");
    assert.equal(toGranularity(undefined), "day");
  });
});

describe("reading a sales file", () => {
  const file = [
    "datum;butik;artikelnummer;benämning;antal;belopp",
    "2026-11-02;Täby Centrum;ART-1;Loop Mango 12;3;150,50",
    "04/11/2026;Linköping;ART-2;Loop Mint 6;2;100",
  ].join("\n");

  it("reads Swedish headers, semicolons and comma decimals", () => {
    const result = parseSalesCsv(file);
    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.lines[0], {
      date: "2026-11-02",
      storeName: "Täby Centrum",
      sku: "ART-1",
      ean: null,
      description: "Loop Mango 12",
      quantity: 3,
      grossAmount: 150.5,
    });
    assert.equal(result.lines[1].date, "2026-11-04", "d/m/Y is read as a Swedish date");
  });

  it("says which column is missing rather than guessing", () => {
    const result = parseSalesCsv("datum;butik;antal\n2026-11-02;Täby;3");
    assert.equal(result.lines.length, 0);
    assert.ok(result.errors.some((error) => /artikelnummer eller EAN/.test(error.message)));
  });

  it("keeps a bad row out and names its line", () => {
    const result = parseSalesCsv(
      ["datum;butik;ean;antal", "inte-ett-datum;Täby;123;3", "2026-11-02;Täby;123;abc"].join("\n")
    );
    assert.equal(result.lines.length, 0);
    assert.deepEqual(
      result.errors.map((error) => error.line),
      [2, 3]
    );
  });

  it("keeps a negative line, because a return is a fact", () => {
    const result = parseSalesCsv("datum;butik;ean;antal\n2026-11-02;Täby;123;-2");
    assert.equal(result.lines[0].quantity, -2);
  });

  it("drops the time of day from a timestamp", () => {
    assert.equal(parseDate("2026-11-02T14:35:00"), "2026-11-02");
    assert.equal(parseDate("20261102"), "2026-11-02");
    assert.equal(parseDate("2026-02-30"), null, "February has no 30th");
    assert.equal(parseDate("hej"), null);
  });

  it("reads numbers written either way", () => {
    assert.equal(parseNumber("1 234,50"), 1234.5);
    assert.equal(parseNumber("1234.50"), 1234.5);
    assert.equal(parseNumber(""), null);
    assert.equal(parseNumber("abc"), null);
  });
});

describe("periods", () => {
  const today = "2026-11-19";

  it("resolves each named period", () => {
    assert.deepEqual(rangeFor({ period: "7", today }), { from: "2026-11-13", to: today });
    assert.deepEqual(rangeFor({ period: "30", today }), { from: "2026-10-21", to: today });
    assert.deepEqual(rangeFor({ period: "week", today }), { from: "2026-11-16", to: today });
    assert.deepEqual(rangeFor({ period: "month", today }), { from: "2026-11-01", to: today });
  });

  it("swaps a backwards custom range rather than showing nothing", () => {
    assert.deepEqual(
      rangeFor({ period: "custom", today, from: "2026-11-10", to: "2026-11-01" }),
      { from: "2026-11-01", to: "2026-11-10" }
    );
  });

  it("falls back to 30 days for an unknown period", () => {
    assert.equal(toPeriod("fortnight"), "30");
    assert.equal(toPeriod("week"), "week");
  });

  it("puts the comparison period immediately before, same length", () => {
    const range = { from: "2026-11-13", to: "2026-11-19" };
    assert.equal(daysBetween(range.from, range.to), 6);
    assert.deepEqual(previousRange(range), { from: "2026-11-06", to: "2026-11-12" });
  });
});
