import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

/** Throwaway database — never the project's dev.db. */
const dir = mkdtempSync(path.join(tmpdir(), "pc-transfer-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;

let prisma: typeof import("../src/lib/db").prisma;
let repo: typeof import("../src/lib/repositories/transfers");

before(async () => {
  execFileSync("npx", ["prisma", "db", "push"], {
    env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
    stdio: "pipe",
  });
  ({ prisma } = await import("../src/lib/db"));
  repo = await import("../src/lib/repositories/transfers");
});

after(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

let counter = 0;
async function fixture() {
  const suffix = `${Date.now()}-${counter++}`;
  const [asker, a, b] = await Promise.all([
    prisma.store.create({ data: { name: `Ask ${suffix}`, slug: `ask-${suffix}`, region: "R" }, select: { id: true, name: true } }),
    prisma.store.create({ data: { name: `A ${suffix}`, slug: `a-${suffix}`, region: "R" }, select: { id: true, name: true } }),
    prisma.store.create({ data: { name: `B ${suffix}`, slug: `b-${suffix}`, region: "R" }, select: { id: true, name: true } }),
  ]);
  const user = await prisma.user.create({
    data: { email: `u-${suffix}@example.test`, hashedPassword: "x" },
    select: { id: true },
  });
  const product = await prisma.product.create({
    data: {
      brand: "Testmärke",
      flavor: `Smak ${suffix}`,
      strength: "8mg",
      format: "Normal",
      pricePerStock: 100,
    },
    select: { id: true },
  });

  const transferId = await repo.createTransfer({
    requestingStoreId: asker.id,
    targetStoreId: null,
    createdById: user.id,
    note: null,
    lines: [{ productId: product.id, quantity: 2, unit: "STOCK" }],
  });

  return { asker, a, b, user, transferId };
}

describe("first to accept wins", () => {
  it("lets exactly one store accept when two try at once", async () => {
    const { a, b, user, transferId } = await fixture();

    const results = await Promise.allSettled([
      repo.acceptTransfer({ transferId, acceptingStoreId: a.id, userId: user.id }),
      repo.acceptTransfer({ transferId, acceptingStoreId: b.id, userId: user.id }),
    ]);

    const won = results.filter((result) => result.status === "fulfilled");
    const lost = results.filter((result) => result.status === "rejected");

    assert.equal(won.length, 1, "exactly one accept should succeed");
    assert.equal(lost.length, 1, "exactly one accept should be refused");

    const rejection = (lost[0] as PromiseRejectedResult).reason;
    assert.ok(
      rejection instanceof repo.TransferConflictError,
      "the loser should get a conflict naming the winner"
    );
    assert.ok([a.name, b.name].includes(rejection.acceptedByStoreName));
  });

  it("records only one accepting store and one ACCEPTED event", async () => {
    const { a, b, user, transferId } = await fixture();

    await repo.acceptTransfer({ transferId, acceptingStoreId: a.id, userId: user.id });
    await assert.rejects(
      repo.acceptTransfer({ transferId, acceptingStoreId: b.id, userId: user.id }),
      repo.TransferConflictError
    );

    const transfer = await repo.getTransfer(transferId);
    assert.equal(transfer!.acceptingStore?.id, a.id);
    assert.equal(transfer!.status, "ACCEPTED");
    assert.equal(transfer!.events.filter((event) => event.type === "ACCEPTED").length, 1);
  });

  it("names the store that won, so the loser sees who took it", async () => {
    const { a, b, user, transferId } = await fixture();
    await repo.acceptTransfer({ transferId, acceptingStoreId: a.id, userId: user.id });

    try {
      await repo.acceptTransfer({ transferId, acceptingStoreId: b.id, userId: user.id });
      assert.fail("should have thrown");
    } catch (error) {
      assert.ok(error instanceof repo.TransferConflictError);
      assert.equal(error.acceptedByStoreName, a.name);
    }
  });
});

describe("transfer status transitions in the database", () => {
  it("walks the happy path and refuses to go backwards", async () => {
    const { a, user, transferId } = await fixture();

    await repo.acceptTransfer({ transferId, acceptingStoreId: a.id, userId: user.id });
    await repo.moveTransfer({ transferId, to: "SENT", userId: user.id });
    await repo.moveTransfer({ transferId, to: "RECEIVED", userId: user.id });

    const transfer = await repo.getTransfer(transferId);
    assert.equal(transfer!.status, "RECEIVED");
    assert.deepEqual(
      transfer!.events.map((event) => event.type),
      ["CREATED", "ACCEPTED", "SENT", "RECEIVED"]
    );

    // Terminal: nothing moves it again.
    await assert.rejects(
      repo.moveTransfer({ transferId, to: "SENT", userId: user.id }),
      repo.TransferTransitionError
    );
  });

  it("refuses to skip a step", async () => {
    const { user, transferId } = await fixture();
    await assert.rejects(
      repo.moveTransfer({ transferId, to: "RECEIVED", userId: user.id }),
      repo.TransferTransitionError
    );
    await assert.rejects(
      repo.moveTransfer({ transferId, to: "SENT", userId: user.id }),
      repo.TransferTransitionError
    );
  });

  it("cannot be accepted after it was declined", async () => {
    const { a, user, transferId } = await fixture();
    await repo.moveTransfer({ transferId, to: "DECLINED", userId: user.id });

    await assert.rejects(
      repo.acceptTransfer({ transferId, acceptingStoreId: a.id, userId: user.id }),
      repo.TransferConflictError
    );
  });

  it("stores the unit on every line rather than assuming", async () => {
    const { transferId } = await fixture();
    const transfer = await repo.getTransfer(transferId);
    assert.equal(transfer!.lines[0].unit, "STOCK");
    assert.equal(transfer!.lines[0].quantity, 2);
  });
});
