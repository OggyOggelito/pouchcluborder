import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_ISSUE_TRANSITIONS,
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
  MAX_ISSUE_TEXT_LENGTH,
  canTransitionIssue,
  clampIssueText,
  isOpenStatus,
  toIssueCategory,
  toIssueStatus,
} from "../src/lib/issues";

describe("issue status flow", () => {
  it("allows the documented moves", () => {
    assert.ok(canTransitionIssue("NEW", "IN_PROGRESS"));
    assert.ok(canTransitionIssue("NEW", "RESOLVED"));
    assert.ok(canTransitionIssue("IN_PROGRESS", "RESOLVED"));
  });

  it("lets a resolved report be reopened, because problems come back", () => {
    assert.ok(canTransitionIssue("RESOLVED", "IN_PROGRESS"));
  });

  it("never returns a report to NEW", () => {
    // NEW means "nobody has looked at this yet", which stops being true the
    // moment somebody has.
    assert.ok(!canTransitionIssue("IN_PROGRESS", "NEW"));
    assert.ok(!canTransitionIssue("RESOLVED", "NEW"));
  });

  it("refuses a move to the status it is already in", () => {
    for (const status of ISSUE_STATUSES) {
      assert.ok(!canTransitionIssue(status, status), `${status} -> ${status}`);
    }
  });

  it("lists a target for every status, so nothing is a dead end", () => {
    for (const status of ISSUE_STATUSES) {
      assert.ok(
        ALLOWED_ISSUE_TRANSITIONS[status].length > 0,
        `${status} should have somewhere to go`
      );
    }
  });

  it("counts NEW and IN_PROGRESS as open", () => {
    assert.equal(isOpenStatus("NEW"), true);
    assert.equal(isOpenStatus("IN_PROGRESS"), true);
    assert.equal(isOpenStatus("RESOLVED"), false);
  });
});

describe("issue input validation", () => {
  it("falls back to OTHER for an unknown category", () => {
    for (const value of ["BROKEN_DREAMS", "", null, undefined, 3]) {
      assert.equal(toIssueCategory(value), "OTHER", `${String(value)} should fall back`);
    }
    for (const category of ISSUE_CATEGORIES) {
      assert.equal(toIssueCategory(category), category);
    }
  });

  it("falls back to NEW for an unknown status", () => {
    for (const value of ["CLOSED", "", null, undefined]) {
      assert.equal(toIssueStatus(value), "NEW", `${String(value)} should fall back`);
    }
    for (const status of ISSUE_STATUSES) {
      assert.equal(toIssueStatus(status), status);
    }
  });

  it("caps the text and treats blank as empty", () => {
    assert.equal(clampIssueText("x".repeat(MAX_ISSUE_TEXT_LENGTH + 10)).length, MAX_ISSUE_TEXT_LENGTH);
    assert.equal(clampIssueText("  trasig kyl  "), "trasig kyl");
    assert.equal(clampIssueText("   "), "");
    assert.equal(clampIssueText(null), "");
  });

  it("honours a shorter cap for comments", () => {
    assert.equal(clampIssueText("x".repeat(50), 10).length, 10);
  });
});
