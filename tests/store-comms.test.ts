import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ARCHIVE_AFTER_DAYS } from "../src/lib/shift-notes";

/** Throwaway database — never the project's dev.db. */
const dir = mkdtempSync(path.join(tmpdir(), "pc-comms-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;

let prisma: typeof import("../src/lib/db").prisma;
let notes: typeof import("../src/lib/repositories/shift-notes");
let issues: typeof import("../src/lib/repositories/issues");
let knowledge: typeof import("../src/lib/repositories/knowledge");

before(async () => {
  execFileSync("npx", ["prisma", "db", "push"], {
    env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
    stdio: "pipe",
  });
  ({ prisma } = await import("../src/lib/db"));
  notes = await import("../src/lib/repositories/shift-notes");
  issues = await import("../src/lib/repositories/issues");
  knowledge = await import("../src/lib/repositories/knowledge");
});

after(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

let counter = 0;

/** Two stores and two people, one with access to each store. */
async function fixture() {
  const suffix = `${Date.now()}-${counter++}`;
  const [mine, theirs] = await Promise.all([
    prisma.store.create({
      data: { name: `Min ${suffix}`, slug: `min-${suffix}`, region: "R" },
      select: { id: true, name: true },
    }),
    prisma.store.create({
      data: { name: `Deras ${suffix}`, slug: `deras-${suffix}`, region: "R" },
      select: { id: true, name: true },
    }),
  ]);

  const [me, them] = await Promise.all([
    prisma.user.create({
      data: {
        email: `me-${suffix}@example.test`,
        hashedPassword: "x",
        name: "Jag",
        storeAccess: { create: { storeId: mine.id } },
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        email: `them-${suffix}@example.test`,
        hashedPassword: "x",
        name: "Dem",
        storeAccess: { create: { storeId: theirs.id } },
      },
      select: { id: true },
    }),
  ]);

  return { mine, theirs, me, them };
}

describe("shift note scoping", () => {
  it("shows a store's notes to that store and not to another", async () => {
    const { mine, theirs, me, them } = await fixture();

    await notes.createNote({ storeId: mine.id, authorId: me.id, text: "Mitt", category: "INFO" });
    await notes.createNote({
      storeId: theirs.id,
      authorId: them.id,
      text: "Deras",
      category: "INFO",
    });

    const forMe = await notes.listNotes({ storeIds: [mine.id], archived: false });
    assert.deepEqual(forMe.map((note) => note.text), ["Mitt"]);

    const forThem = await notes.listNotes({ storeIds: [theirs.id], archived: false });
    assert.deepEqual(forThem.map((note) => note.text), ["Deras"]);

    // An admin passes every store id and sees both.
    const forAdmin = await notes.listNotes({ storeIds: [mine.id, theirs.id], archived: false });
    assert.deepEqual(new Set(forAdmin.map((note) => note.text)), new Set(["Mitt", "Deras"]));
  });

  it("returns nothing for an account with no stores, rather than everything", async () => {
    const { mine, me } = await fixture();
    await notes.createNote({ storeId: mine.id, authorId: me.id, text: "Hemligt", category: "INFO" });

    assert.deepEqual(await notes.listNotes({ storeIds: [], archived: false }), []);
    assert.equal(await notes.countOpenTodos([]), 0);
  });
});

describe("shift note archiving", () => {
  it("moves an explicitly archived note out of the feed and into the archive", async () => {
    const { mine, me } = await fixture();
    const id = await notes.createNote({
      storeId: mine.id,
      authorId: me.id,
      text: "Arkivera mig",
      category: "INFO",
    });

    await notes.archiveNote(id);

    const feed = await notes.listNotes({ storeIds: [mine.id], archived: false });
    assert.equal(feed.find((note) => note.id === id), undefined);

    const archive = await notes.listNotes({ storeIds: [mine.id], archived: true });
    assert.ok(archive.some((note) => note.id === id), "should be in the archive");
  });

  it("does not delete anything when archiving", async () => {
    const { mine, me } = await fixture();
    const id = await notes.createNote({
      storeId: mine.id,
      authorId: me.id,
      text: "Finns kvar",
      category: "INFO",
    });

    await notes.archiveNote(id);
    const row = await prisma.shiftNote.findUnique({ where: { id }, select: { text: true } });
    assert.equal(row?.text, "Finns kvar");
  });

  it("keeps an IMPORTANT note at the top until it is archived", async () => {
    const { mine, me } = await fixture();

    const important = await notes.createNote({
      storeId: mine.id,
      authorId: me.id,
      text: "Viktigt",
      category: "IMPORTANT",
    });
    await notes.createNote({
      storeId: mine.id,
      authorId: me.id,
      text: "Nyare info",
      category: "INFO",
    });

    const before = await notes.listNotes({ storeIds: [mine.id], archived: false });
    assert.equal(before[0]?.id, important, "the IMPORTANT note should sort first");

    await notes.archiveNote(important);
    const after = await notes.listNotes({ storeIds: [mine.id], archived: false });
    assert.equal(after[0]?.text, "Nyare info");
  });

  it("ages an old note into the archive but leaves a pinned one in the feed", async () => {
    const { mine, me } = await fixture();

    const old = await notes.createNote({
      storeId: mine.id,
      authorId: me.id,
      text: "Gammal",
      category: "INFO",
    });
    const pinned = await notes.createNote({
      storeId: mine.id,
      authorId: me.id,
      text: "Fastnålad",
      category: "IMPORTANT",
    });

    // Backdate both past the cutoff. IMPORTANT notes are pinned on creation.
    const longAgo = new Date(Date.now() - (ARCHIVE_AFTER_DAYS + 5) * 86_400_000);
    await prisma.shiftNote.updateMany({
      where: { id: { in: [old, pinned] } },
      data: { createdAt: longAgo },
    });

    const feed = await notes.listNotes({ storeIds: [mine.id], archived: false });
    assert.deepEqual(feed.map((note) => note.id), [pinned]);

    const archive = await notes.listNotes({ storeIds: [mine.id], archived: true });
    assert.deepEqual(archive.map((note) => note.id), [old]);
  });
});

describe("TODO notes", () => {
  it("records who ticked it off and when, and clears both on un-ticking", async () => {
    const { mine, me } = await fixture();
    const id = await notes.createNote({
      storeId: mine.id,
      authorId: me.id,
      text: "Fyll på hyllan",
      category: "TODO",
    });

    assert.equal(await notes.countOpenTodos([mine.id]), 1);

    await notes.setTodoResolved({ id, resolved: true, userId: me.id });
    const [ticked] = await notes.listNotes({ storeIds: [mine.id], archived: false });
    assert.ok(ticked.resolvedAt instanceof Date);
    assert.equal(ticked.resolvedByName, "Jag");
    assert.equal(await notes.countOpenTodos([mine.id]), 0);

    await notes.setTodoResolved({ id, resolved: false, userId: me.id });
    const [unticked] = await notes.listNotes({ storeIds: [mine.id], archived: false });
    assert.equal(unticked.resolvedAt, null);
    assert.equal(unticked.resolvedByName, null, "no resolver without a resolution time");
    assert.equal(await notes.countOpenTodos([mine.id]), 1);
  });

  it("does not count an archived TODO as open", async () => {
    const { mine, me } = await fixture();
    const id = await notes.createNote({
      storeId: mine.id,
      authorId: me.id,
      text: "Glömd",
      category: "TODO",
    });

    await notes.archiveNote(id);
    assert.equal(await notes.countOpenTodos([mine.id]), 0);
  });
});

describe("problem report scoping and status flow", () => {
  it("shows a store's reports to that store only", async () => {
    const { mine, theirs, me, them } = await fixture();

    await issues.createIssue({
      storeId: mine.id,
      reporterId: me.id,
      category: "EQUIPMENT",
      productId: null,
      text: "Kylen är trasig",
    });
    await issues.createIssue({
      storeId: theirs.id,
      reporterId: them.id,
      category: "DELIVERY",
      productId: null,
      text: "Leveransen saknas",
    });

    const forMe = await issues.listIssuesForStores({ storeIds: [mine.id] });
    assert.deepEqual(forMe.map((issue) => issue.text), ["Kylen är trasig"]);
    assert.deepEqual(await issues.listIssuesForStores({ storeIds: [] }), []);
  });

  it("opens with a CREATED event and appends every change", async () => {
    const { mine, me } = await fixture();
    const id = await issues.createIssue({
      storeId: mine.id,
      reporterId: me.id,
      category: "DAMAGED_GOODS",
      productId: null,
      text: "Krossade dosor",
    });

    await issues.setIssueStatus({ issueId: id, to: "IN_PROGRESS", userId: me.id });
    await issues.addIssueComment({ issueId: id, userId: me.id, text: "Vaktmästaren kontaktad" });
    await issues.setIssueStatus({ issueId: id, to: "RESOLVED", userId: me.id });

    const issue = await issues.getIssue(id);
    assert.equal(issue!.status, "RESOLVED");
    assert.deepEqual(
      issue!.events.map((event) => event.type),
      ["CREATED", "STATUS", "COMMENT", "STATUS"]
    );
  });

  it("refuses a move the status flow does not allow", async () => {
    const { mine, me } = await fixture();
    const id = await issues.createIssue({
      storeId: mine.id,
      reporterId: me.id,
      category: "OTHER",
      productId: null,
      text: "Något",
    });

    await issues.setIssueStatus({ issueId: id, to: "RESOLVED", userId: me.id });

    // Nothing ever goes back to NEW.
    await assert.rejects(
      issues.setIssueStatus({ issueId: id, to: "NEW", userId: me.id }),
      issues.IssueTransitionError
    );

    // Reopening is allowed, and leaves a trail.
    await issues.setIssueStatus({ issueId: id, to: "IN_PROGRESS", userId: me.id });
    const issue = await issues.getIssue(id);
    assert.equal(issue!.status, "IN_PROGRESS");
    assert.equal(issue!.events.filter((event) => event.type === "STATUS").length, 2);
  });

  it("records one event when two admins resolve it at the same moment", async () => {
    const { mine, me } = await fixture();
    const id = await issues.createIssue({
      storeId: mine.id,
      reporterId: me.id,
      category: "OTHER",
      productId: null,
      text: "Två admins samtidigt",
    });

    await Promise.all([
      issues.setIssueStatus({ issueId: id, to: "RESOLVED", userId: me.id }),
      issues.setIssueStatus({ issueId: id, to: "RESOLVED", userId: me.id }),
    ]);

    const issue = await issues.getIssue(id);
    assert.equal(issue!.status, "RESOLVED");
    assert.equal(
      issue!.events.filter((event) => event.type === "STATUS").length,
      1,
      "the second click must not add a second STATUS event"
    );
  });

  it("stays on a legal path when two different moves arrive together", async () => {
    // Both are valid here: whichever transaction reads the row first moves
    // NEW -> IN_PROGRESS, and the other then reads IN_PROGRESS and moves on to
    // RESOLVED. The property that matters is that each move was checked
    // against the status as it actually was, so the report cannot end up
    // somewhere the flow does not allow.
    const { mine, me } = await fixture();
    const id = await issues.createIssue({
      storeId: mine.id,
      reporterId: me.id,
      category: "OTHER",
      productId: null,
      text: "Olika drag samtidigt",
    });

    await Promise.all([
      issues.setIssueStatus({ issueId: id, to: "IN_PROGRESS", userId: me.id }),
      issues.setIssueStatus({ issueId: id, to: "RESOLVED", userId: me.id }),
    ]);

    const issue = await issues.getIssue(id);
    assert.ok(
      ["IN_PROGRESS", "RESOLVED"].includes(issue!.status),
      `unexpected end state ${issue!.status}`
    );

    // One event per move that actually happened, and every one of them legal.
    const statuses = issue!.events
      .filter((event) => event.type === "STATUS")
      .map((event) => event.detail);
    assert.ok(statuses.length >= 1 && statuses.length <= 2);
    assert.ok(!statuses.includes("NEW"), "nothing may move a report back to NEW");
  });

  it("counts open reports and ignores resolved ones", async () => {
    const { mine, me } = await fixture();
    const open = await issues.createIssue({
      storeId: mine.id,
      reporterId: me.id,
      category: "OTHER",
      productId: null,
      text: "Öppen",
    });
    const closed = await issues.createIssue({
      storeId: mine.id,
      reporterId: me.id,
      category: "OTHER",
      productId: null,
      text: "Stängd",
    });
    await issues.setIssueStatus({ issueId: closed, to: "RESOLVED", userId: me.id });

    assert.equal(await issues.countOpenIssues([mine.id]), 1);
    assert.equal(await issues.countOpenIssues([]), 0);
    assert.ok((await issues.listIssuesForStores({ storeIds: [mine.id] })).some((i) => i.id === open));
  });

  it("puts unresolved reports first in the admin queue", async () => {
    const { mine, me } = await fixture();
    const first = await issues.createIssue({
      storeId: mine.id,
      reporterId: me.id,
      category: "OTHER",
      productId: null,
      text: "Äldre men öppen",
    });
    const second = await issues.createIssue({
      storeId: mine.id,
      reporterId: me.id,
      category: "OTHER",
      productId: null,
      text: "Nyare men löst",
    });
    await issues.setIssueStatus({ issueId: second, to: "RESOLVED", userId: me.id });

    const queue = await issues.listIssuesForAdmin({ storeId: mine.id });
    assert.equal(queue[0]?.id, first, "the open one should come first despite being older");
  });
});

describe("routine articles", () => {
  it("publishes to staff only when the flag is set", async () => {
    const { me } = await fixture();
    const suffix = `${Date.now()}-${counter++}`;

    await knowledge.createArticle({
      title: `Publicerad ${suffix}`,
      body: "Text",
      category: "Kassa",
      published: true,
      userId: me.id,
    });
    await knowledge.createArticle({
      title: `Utkast ${suffix}`,
      body: "Text",
      category: "Kassa",
      published: false,
      userId: me.id,
    });

    const published = await knowledge.listPublishedArticles();
    assert.ok(published.some((row) => row.title === `Publicerad ${suffix}`));
    assert.ok(
      !published.some((row) => row.title === `Utkast ${suffix}`),
      "a draft must not reach the staff page"
    );

    const all = await knowledge.listAllArticles();
    assert.ok(all.some((row) => row.title === `Utkast ${suffix}`));
  });

  it("keeps the slug when the title changes, so links keep working", async () => {
    const { me } = await fixture();
    const id = await knowledge.createArticle({
      title: `Gammal rubrik ${counter++}`,
      body: "Text",
      category: null,
      published: true,
      userId: me.id,
    });

    const before = await knowledge.getArticleById(id);
    await knowledge.updateArticle({
      id,
      title: "Helt ny rubrik",
      body: "Text",
      category: null,
      published: true,
      userId: me.id,
    });
    const after = await knowledge.getArticleById(id);

    assert.equal(after!.slug, before!.slug);
    assert.equal(after!.title, "Helt ny rubrik");
  });

  it("gives two articles with the same title different slugs", async () => {
    const { me } = await fixture();
    const title = `Samma rubrik ${Date.now()}-${counter++}`;

    const a = await knowledge.createArticle({
      title,
      body: "A",
      category: null,
      published: false,
      userId: me.id,
    });
    const b = await knowledge.createArticle({
      title,
      body: "B",
      category: null,
      published: false,
      userId: me.id,
    });

    const [first, second] = await Promise.all([
      knowledge.getArticleById(a),
      knowledge.getArticleById(b),
    ]);
    assert.notEqual(first!.slug, second!.slug);
  });

  it("leaves articles alone when their category is deleted", async () => {
    const { me } = await fixture();
    const name = `Tillfällig ${Date.now()}-${counter++}`;

    await knowledge.createCategory(name);
    const id = await knowledge.createArticle({
      title: `Artikel i ${name}`,
      body: "Text",
      category: name,
      published: true,
      userId: me.id,
    });

    const category = (await knowledge.listCategories()).find((row) => row.name === name);
    assert.equal(category?.articleCount, 1);

    await knowledge.deleteCategory(category!.id);

    const article = await knowledge.getArticleById(id);
    assert.equal(article!.category, name, "the article keeps the value it was filed under");
    assert.equal(article!.published, true);
  });

  it("does not create the same category twice", async () => {
    const name = `Unik ${Date.now()}-${counter++}`;
    await knowledge.createCategory(name);
    await knowledge.createCategory(name);
    await knowledge.createCategory(`  ${name}  `);

    const matches = (await knowledge.listCategories()).filter((row) => row.name === name);
    assert.equal(matches.length, 1);
  });
});
