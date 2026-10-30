import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

/**
 * Runs against a throwaway SQLite file, never the project's dev.db, so the
 * tests can create and delete freely without touching real data.
 *
 * DATABASE_URL is set before the Prisma client is imported, because
 * src/lib/db.ts reads it at module load.
 */
const dir = mkdtempSync(path.join(tmpdir(), "pc-checklist-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;

type Prisma = typeof import("../src/lib/db").prisma;
let prisma: Prisma;
let repo: typeof import("../src/lib/repositories/checklists");

before(async () => {
  // `--skip-generate` is not a flag in this Prisma version; it prints usage
  // and exits non-zero.
  execFileSync("npx", ["prisma", "db", "push"], {
    env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
    stdio: "pipe",
  });
  ({ prisma } = await import("../src/lib/db"));
  repo = await import("../src/lib/repositories/checklists");
});

after(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

async function makeTemplate(titles: string[], type = "DAILY_OPEN") {
  return prisma.checklistTemplate.create({
    data: {
      type,
      title: "EXEMPEL – lista",
      items: {
        create: titles.map((title, index) => ({ title, position: index, required: true })),
      },
    },
    select: { id: true },
  });
}

describe("checklist runs snapshot their template", () => {
  it("copies the template's items when the run is created", async () => {
    const template = await makeTemplate(["Ett", "Två"]);
    const store = await prisma.store.create({
      data: { name: "Testbutik A", slug: "testbutik-a" },
      select: { id: true },
    });

    const runId = await repo.getOrCreateRun({ templateId: template.id, storeId: store.id });
    const run = await repo.getRun(runId);

    assert.ok(run);
    assert.deepEqual(run.items.map((item) => item.title), ["Ett", "Två"]);
    assert.equal(run.progress.total, 2);
    assert.equal(run.progress.done, 0);
  });

  it("does not change a started run when the template is edited afterwards", async () => {
    const template = await makeTemplate(["Original A", "Original B"]);
    const store = await prisma.store.create({
      data: { name: "Testbutik B", slug: "testbutik-b" },
      select: { id: true },
    });

    const runId = await repo.getOrCreateRun({ templateId: template.id, storeId: store.id });

    // Rename the template, retitle an item, add one, and delete another.
    await prisma.checklistTemplate.update({
      where: { id: template.id },
      data: { title: "Omdöpt mall" },
    });
    const items = await prisma.checklistItem.findMany({
      where: { templateId: template.id },
      orderBy: { position: "asc" },
    });
    await prisma.checklistItem.update({
      where: { id: items[0].id },
      data: { title: "ÄNDRAD" },
    });
    await prisma.checklistItem.delete({ where: { id: items[1].id } });
    await prisma.checklistItem.create({
      data: { templateId: template.id, title: "Tillagd efteråt", position: 9 },
    });

    const run = await repo.getRun(runId);
    assert.ok(run);
    // The run still shows what it was created with.
    assert.equal(run.title, "EXEMPEL – lista");
    assert.deepEqual(run.items.map((item) => item.title), ["Original A", "Original B"]);
    assert.ok(!run.items.some((item) => item.title === "Tillagd efteråt"));
  });

  it("reuses one run per store per day, and separates stores", async () => {
    const template = await makeTemplate(["Ett"]);
    const [a, b] = await Promise.all([
      prisma.store.create({ data: { name: "Dag A", slug: "dag-a" }, select: { id: true } }),
      prisma.store.create({ data: { name: "Dag B", slug: "dag-b" }, select: { id: true } }),
    ]);

    const first = await repo.getOrCreateRun({ templateId: template.id, storeId: a.id });
    const second = await repo.getOrCreateRun({ templateId: template.id, storeId: a.id });
    const other = await repo.getOrCreateRun({ templateId: template.id, storeId: b.id });

    assert.equal(first, second, "same store, same day should reuse the run");
    assert.notEqual(first, other, "a different store gets its own run");
  });

  it("creates a separate run for a different day", async () => {
    const template = await makeTemplate(["Ett"]);
    const store = await prisma.store.create({
      data: { name: "Dag C", slug: "dag-c" },
      select: { id: true },
    });

    const today = await repo.getOrCreateRun({ templateId: template.id, storeId: store.id });
    const tomorrow = await repo.getOrCreateRun({
      templateId: template.id,
      storeId: store.id,
      now: new Date(Date.now() + 36 * 60 * 60 * 1000),
    });

    assert.notEqual(today, tomorrow);
  });

  it("records who ticked an item and when, and clears both on untick", async () => {
    const template = await makeTemplate(["Ett"]);
    const store = await prisma.store.create({
      data: { name: "Tick", slug: "tick" },
      select: { id: true },
    });
    const user = await prisma.user.create({
      data: { email: "tick@example.test", hashedPassword: "x", name: "Testa Testsson" },
      select: { id: true },
    });

    const runId = await repo.getOrCreateRun({ templateId: template.id, storeId: store.id });
    const before = await repo.getRun(runId);
    const itemId = before!.items[0].id;

    await repo.setItemChecked({ itemId, checked: true, userId: user.id });
    const ticked = await repo.getRun(runId);
    assert.ok(ticked!.items[0].checkedAt instanceof Date);
    assert.equal(ticked!.items[0].checkedByName, "Testa Testsson");
    assert.equal(ticked!.progress.done, 1);

    await repo.setItemChecked({ itemId, checked: false, userId: user.id });
    const unticked = await repo.getRun(runId);
    assert.equal(unticked!.items[0].checkedAt, null);
    assert.equal(unticked!.items[0].checkedByName, null);
  });

  it("keeps an onboarding run to one per person per template", async () => {
    const template = await makeTemplate(["Läs guiden"], "ONBOARDING");
    const user = await prisma.user.create({
      data: { email: "onboard@example.test", hashedPassword: "x" },
      select: { id: true },
    });

    const first = await repo.getOrCreateRun({ templateId: template.id, userId: user.id });
    const second = await repo.getOrCreateRun({ templateId: template.id, userId: user.id });
    assert.equal(first, second);

    const runs = await repo.listOnboardingRunsForUser(user.id);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].progress.total, 1);
  });
});
