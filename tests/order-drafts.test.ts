import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  isRestorable,
  lineCount,
  mayOverwrite,
  parseLines,
  pruneToCatalog,
  serializeLines,
  totalQuantity,
} from "../src/lib/order-drafts";

describe("draft lines", () => {
  it("round-trips through JSON", () => {
    const lines = { a: 2, b: 1 };
    assert.deepEqual(parseLines(serializeLines(lines)), lines);
  });

  it("survives anything the storage might hand back", () => {
    for (const raw of [null, undefined, "", "not json", "[]", '"a string"', "123"]) {
      assert.deepEqual(parseLines(raw), {}, `${String(raw)} should parse to nothing`);
    }
  });

  it("drops zero, negative and non-numeric quantities rather than keeping them", () => {
    const parsed = parseLines('{"a":2,"b":0,"c":-3,"d":"5","e":null,"f":1.7}');
    // 1.7 truncates to 1 — a draft is whole stockar, and refusing it entirely
    // would lose a line the person did choose.
    assert.deepEqual(parsed, { a: 2, f: 1 });
  });

  it("counts lines and stockar separately", () => {
    const lines = { a: 2, b: 5 };
    assert.equal(lineCount(lines), 2);
    assert.equal(totalQuantity(lines), 7);
    assert.equal(isRestorable(lines), true);
    assert.equal(isRestorable({}), false);
  });
});

describe("a draft that outlived a catalog import", () => {
  it("keeps the lines whose product still exists and counts the rest", () => {
    const { lines, dropped } = pruneToCatalog({ keep: 2, gone: 1, alsoKeep: 3 }, [
      "keep",
      "alsoKeep",
    ]);
    assert.deepEqual(lines, { keep: 2, alsoKeep: 3 });
    assert.equal(dropped, 1, "the caller needs the number so it can say so");
  });

  it("drops everything when the catalog is empty, without throwing", () => {
    const { lines, dropped } = pruneToCatalog({ a: 1 }, []);
    assert.deepEqual(lines, {});
    assert.equal(dropped, 1);
  });
});

describe("overwrite rules", () => {
  it("lets a client that is up to date save", () => {
    assert.equal(mayOverwrite(3, 3), true);
  });

  it("refuses a client whose draft moved on somewhere else", () => {
    assert.equal(mayOverwrite(1, 6), false);
  });

  it("lets a client that has never saved win, having nothing to lose", () => {
    assert.equal(mayOverwrite(0, 9), true);
  });
});

// ---------------------------------------------------------------------------
// Against a real database
// ---------------------------------------------------------------------------

const dir = mkdtempSync(path.join(tmpdir(), "pc-drafts-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;

let prisma: typeof import("../src/lib/db").prisma;
let repo: typeof import("../src/lib/repositories/order-drafts");

before(async () => {
  execFileSync("npx", ["prisma", "db", "push"], {
    env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
    stdio: "pipe",
  });
  ({ prisma } = await import("../src/lib/db"));
  repo = await import("../src/lib/repositories/order-drafts");
});

after(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

let counter = 0;
async function fixture() {
  const suffix = `${Date.now()}-${counter++}`;
  const store = await prisma.store.create({
    data: { name: `Butik ${suffix}`, slug: `butik-${suffix}` },
    select: { id: true, name: true },
  });
  const user = await prisma.user.create({
    data: { email: `u-${suffix}@example.test`, hashedPassword: "x" },
    select: { id: true },
  });
  return { store, user };
}

describe("autosave and recovery", () => {
  it("saves a draft and reads it back whole", async () => {
    const { store, user } = await fixture();

    const saved = await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: { "product-a": 2 },
      note: "brådskande",
      clientVersion: 0,
    });
    assert.equal(saved.kind, "saved");

    const draft = await repo.getDraft(user.id, store.id);
    assert.deepEqual(draft?.lines, { "product-a": 2 });
    assert.equal(draft?.note, "brådskande");
    assert.equal(draft?.storeName, store.name);
  });

  it("bumps the version on every save, so a stale client can be spotted", async () => {
    const { store, user } = await fixture();

    const first = await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: { a: 1 },
      note: null,
      clientVersion: 0,
    });
    assert.equal(first.kind === "saved" && first.version, 1);

    const second = await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: { a: 2 },
      note: null,
      clientVersion: 1,
    });
    assert.equal(second.kind === "saved" && second.version, 2);
  });

  it("refuses to overwrite a draft edited on another device", async () => {
    const { store, user } = await fixture();

    await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: { a: 1 },
      note: null,
      clientVersion: 0,
    });
    // The other device saves twice; this client still thinks it is at 1.
    await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: { a: 5 },
      note: null,
      clientVersion: 1,
    });

    const stale = await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: { a: 99 },
      note: null,
      clientVersion: 1,
    });

    assert.equal(stale.kind, "conflict");

    // And the other device's work is still there, untouched.
    const draft = await repo.getDraft(user.id, store.id);
    assert.deepEqual(draft?.lines, { a: 5 });
  });

  it("keeps one draft per user and store", async () => {
    const { store, user } = await fixture();
    const other = await fixture();

    await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: { a: 1 },
      note: null,
      clientVersion: 0,
    });
    await repo.saveDraft({
      userId: user.id,
      storeId: other.store.id,
      lines: { b: 2 },
      note: null,
      clientVersion: 0,
    });

    const mine = await repo.listDraftsForUser(user.id);
    assert.equal(mine.length, 2, "a person covering two stores keeps two baskets");
    assert.deepEqual(
      new Set(mine.map((draft) => draft.storeId)),
      new Set([store.id, other.store.id])
    );
  });

  it("hides an emptied draft from the home screen rather than offering nothing", async () => {
    const { store, user } = await fixture();

    await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: { a: 1 },
      note: null,
      clientVersion: 0,
    });
    await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: {},
      note: null,
      clientVersion: 1,
    });

    assert.deepEqual(await repo.listDraftsForUser(user.id), []);
  });

  it("is gone once the order is submitted", async () => {
    const { store, user } = await fixture();

    await repo.saveDraft({
      userId: user.id,
      storeId: store.id,
      lines: { a: 1 },
      note: null,
      clientVersion: 0,
    });
    await repo.deleteDraft(user.id, store.id);

    assert.equal(await repo.getDraft(user.id, store.id), null);
  });

  it("does not throw when deleting a draft that was never there", async () => {
    const { store, user } = await fixture();
    await repo.deleteDraft(user.id, store.id);
  });
});
