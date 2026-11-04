import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVE_AFTER_DAYS,
  MAX_NOTE_LENGTH,
  archiveCutoff,
  clampNoteText,
  isArchived,
  isOpenTodo,
  noteRank,
  sortNotes,
  toNoteCategory,
  type NoteCategory,
} from "../src/lib/shift-notes";

const NOW = new Date("2026-11-04T12:00:00Z");

function note(overrides: {
  category?: NoteCategory;
  pinned?: boolean;
  archivedAt?: Date | null;
  daysOld?: number;
  resolvedAt?: Date | null;
}) {
  const daysOld = overrides.daysOld ?? 0;
  return {
    category: overrides.category ?? "INFO",
    pinned: overrides.pinned ?? false,
    archivedAt: overrides.archivedAt ?? null,
    createdAt: new Date(NOW.getTime() - daysOld * 86_400_000),
    resolvedAt: overrides.resolvedAt ?? null,
  };
}

describe("archiving by age", () => {
  it("keeps a note in the feed right up to the cutoff", () => {
    assert.equal(isArchived(note({ daysOld: 0 }), NOW), false);
    assert.equal(isArchived(note({ daysOld: ARCHIVE_AFTER_DAYS - 1 }), NOW), false);
  });

  it("hides a note once it is older than the cutoff", () => {
    assert.equal(isArchived(note({ daysOld: ARCHIVE_AFTER_DAYS + 1 }), NOW), true);
    assert.equal(isArchived(note({ daysOld: 365 }), NOW), true);
  });

  it("uses the named constant, not a hardcoded 30", () => {
    const cutoff = archiveCutoff(NOW);
    assert.equal(
      Math.round((NOW.getTime() - cutoff.getTime()) / 86_400_000),
      ARCHIVE_AFTER_DAYS
    );
  });

  it("never ages out a pinned note", () => {
    assert.equal(isArchived(note({ daysOld: 400, pinned: true }), NOW), false);
  });

  it("archives on request however new the note is", () => {
    assert.equal(isArchived(note({ daysOld: 0, archivedAt: NOW }), NOW), true);
  });

  it("lets an explicit archive beat a pin", () => {
    // Otherwise an IMPORTANT note, which is pinned on creation, could never be
    // taken off the top of the feed.
    assert.equal(isArchived(note({ pinned: true, archivedAt: NOW }), NOW), true);
  });
});

describe("feed order", () => {
  it("puts pinned above IMPORTANT above everything else", () => {
    assert.ok(noteRank(note({ pinned: true })) < noteRank(note({ category: "IMPORTANT" })));
    assert.ok(noteRank(note({ category: "IMPORTANT" })) < noteRank(note({ category: "INFO" })));
    assert.equal(noteRank(note({ category: "TODO" })), noteRank(note({ category: "INFO" })));
  });

  it("ranks an older IMPORTANT note above a newer INFO note", () => {
    const important = { ...note({ category: "IMPORTANT", daysOld: 5 }), id: "important" };
    const fresh = { ...note({ category: "INFO", daysOld: 0 }), id: "fresh" };

    assert.deepEqual(
      sortNotes([fresh, important]).map((row) => row.id),
      ["important", "fresh"]
    );
  });

  it("is newest-first within a tier", () => {
    const rows = [
      { ...note({ daysOld: 2 }), id: "older" },
      { ...note({ daysOld: 0 }), id: "newest" },
      { ...note({ daysOld: 1 }), id: "middle" },
    ];
    assert.deepEqual(
      sortNotes(rows).map((row) => row.id),
      ["newest", "middle", "older"]
    );
  });

  it("does not mutate the array it was given", () => {
    const rows = [
      { ...note({ daysOld: 2 }), id: "a" },
      { ...note({ category: "IMPORTANT", daysOld: 5 }), id: "b" },
    ];
    sortNotes(rows);
    assert.deepEqual(rows.map((row) => row.id), ["a", "b"]);
  });
});

describe("open TODOs", () => {
  it("counts only unticked, unarchived TODO notes", () => {
    assert.equal(isOpenTodo(note({ category: "TODO" })), true);
    assert.equal(isOpenTodo(note({ category: "TODO", resolvedAt: NOW })), false);
    assert.equal(isOpenTodo(note({ category: "TODO", archivedAt: NOW })), false);
    assert.equal(isOpenTodo(note({ category: "INFO" })), false);
    assert.equal(isOpenTodo(note({ category: "IMPORTANT" })), false);
  });
});

describe("note text and category", () => {
  it("caps the text at the documented length", () => {
    assert.equal(clampNoteText("x".repeat(MAX_NOTE_LENGTH + 500)).length, MAX_NOTE_LENGTH);
  });

  it("trims and treats blank text as empty, so the action can refuse it", () => {
    assert.equal(clampNoteText("  hej  "), "hej");
    assert.equal(clampNoteText("   "), "");
    assert.equal(clampNoteText(null), "");
    assert.equal(clampNoteText(undefined), "");
  });

  it("keeps newlines, because a handover is often a list", () => {
    assert.equal(clampNoteText("rad ett\nrad två"), "rad ett\nrad två");
  });

  it("falls back to INFO for anything unrecognised", () => {
    for (const value of ["URGENT", "", null, undefined, 7, {}]) {
      assert.equal(toNoteCategory(value), "INFO", `${String(value)} should fall back`);
    }
    for (const value of ["INFO", "IMPORTANT", "TODO"] as const) {
      assert.equal(toNoteCategory(value), value);
    }
  });
});
