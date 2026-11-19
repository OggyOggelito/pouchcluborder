import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

/** Throwaway database — never the project's dev.db. */
const dir = mkdtempSync(path.join(tmpdir(), "pc-supplier-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;

let prisma: typeof import("../src/lib/db").prisma;
let suppliers: typeof import("../src/lib/repositories/supplier-users");
let users: typeof import("../src/lib/repositories/users");
let sales: typeof import("../src/lib/repositories/sales");
let demoDays: typeof import("../src/lib/repositories/demo-days");
let hours: typeof import("../src/lib/repositories/opening-hours");
let pauses: typeof import("../src/lib/repositories/order-pause");

before(async () => {
  execFileSync("npx", ["prisma", "db", "push"], {
    env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
    stdio: "pipe",
  });
  ({ prisma } = await import("../src/lib/db"));
  suppliers = await import("../src/lib/repositories/supplier-users");
  users = await import("../src/lib/repositories/users");
  sales = await import("../src/lib/repositories/sales");
  demoDays = await import("../src/lib/repositories/demo-days");
  hours = await import("../src/lib/repositories/opening-hours");
  pauses = await import("../src/lib/repositories/order-pause");
});

after(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

let counter = 0;

/** Two brands, two stores, one supplier login each, a few sold cans. */
async function fixture() {
  const suffix = `${Date.now()}-${counter++}`;

  const [ours, theirs] = await Promise.all([
    prisma.brand.create({
      data: { name: `Vårt ${suffix}`, slug: `vart-${suffix}` },
      select: { id: true, name: true },
    }),
    prisma.brand.create({
      data: { name: `Deras ${suffix}`, slug: `deras-${suffix}` },
      select: { id: true, name: true },
    }),
  ]);

  const [storeA, storeB] = await Promise.all([
    prisma.store.create({
      data: { name: `A ${suffix}`, slug: `a-${suffix}` },
      select: { id: true, name: true },
    }),
    prisma.store.create({
      data: { name: `B ${suffix}`, slug: `b-${suffix}` },
      select: { id: true, name: true },
    }),
  ]);

  const [ourProduct, theirProduct] = await Promise.all([
    prisma.product.create({
      data: {
        brand: ours.name,
        brandId: ours.id,
        flavor: `Mango ${suffix}`,
        strength: "12mg",
        format: "Slim",
        pricePerStock: 100,
        sku: `OURS-${suffix}`,
        eanKfp: `73${suffix.replace(/\D/g, "").slice(0, 10)}`,
      },
      select: { id: true, sku: true, eanKfp: true },
    }),
    prisma.product.create({
      data: {
        brand: theirs.name,
        brandId: theirs.id,
        flavor: `Mint ${suffix}`,
        strength: "6mg",
        format: "Slim",
        pricePerStock: 100,
        sku: `THEIRS-${suffix}`,
      },
      select: { id: true, sku: true },
    }),
  ]);

  const admin = await prisma.user.create({
    data: { email: `admin-${suffix}@example.test`, hashedPassword: "x", role: "ADMIN" },
    select: { id: true },
  });

  const supplier = await prisma.supplierUser.create({
    data: {
      email: `supplier-${suffix}@example.test`,
      brandId: ours.id,
      hashedPassword: "x",
    },
    select: { id: true, email: true },
  });

  // Monday to Sunday 10–18 for both shops, so a demo day has hours to use.
  for (const store of [storeA, storeB]) {
    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      await hours.saveWeekday({
        storeId: store.id,
        weekday,
        opensAt: "10:00",
        closesAt: "18:00",
        closed: false,
      });
    }
  }

  return { ours, theirs, storeA, storeB, ourProduct, theirProduct, admin, supplier };
}

describe("suppliers are not staff accounts", () => {
  it("never appears in a staff user list", async () => {
    const { supplier } = await fixture();

    const staff = await users.listUsers();
    assert.ok(
      !staff.some((row) => row.email === supplier.email),
      "a supplier must not be reachable through the staff user repository"
    );
    assert.ok(
      (await suppliers.listSupplierUsers()).some((row) => row.email === supplier.email),
      "and must be reachable through its own"
    );
  });

  it("cannot be found by the staff sign-in lookup, nor staff by the supplier one", async () => {
    const { supplier, admin } = await fixture();
    const adminRow = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { email: true },
    });

    assert.equal(
      await users.getUserForSignIn(supplier.email),
      null,
      "a supplier email on the staff door finds nothing"
    );
    assert.equal(
      await suppliers.getSupplierForSignIn(adminRow!.email),
      null,
      "and a staff email on the supplier door finds nothing"
    );
  });

  it("gets its brand from the account, not from anything a request can set", async () => {
    const { supplier, ours } = await fixture();
    const record = await suppliers.getSupplierById(supplier.id);
    assert.equal(record?.brand.id, ours.id);
  });

  it("cannot sign in once deactivated, and its link stops working", async () => {
    const { supplier } = await fixture();
    const { token } = await suppliers.issueToken(supplier.id, "RESET");
    assert.equal((await suppliers.lookupToken(token)).ok, true);

    await suppliers.setActive(supplier.id, false);

    assert.equal(await suppliers.getSupplierById(supplier.id), null);
    assert.equal((await suppliers.lookupToken(token)).ok, false);
  });
});

describe("invite and reset links", () => {
  it("stores a hash, never the token", async () => {
    const { ours, admin } = await fixture();
    const { id, token } = await suppliers.createSupplierUser({
      email: `new-${counter++}@example.test`,
      name: null,
      brandId: ours.id,
      invitedById: admin.id,
    });

    const row = await prisma.supplierUser.findUnique({
      where: { id },
      select: { inviteTokenHash: true, hashedPassword: true },
    });
    assert.ok(row?.inviteTokenHash);
    assert.notEqual(row.inviteTokenHash, token, "the token itself is never stored");
    assert.equal(row.hashedPassword, null, "an un-activated account has nothing to guess");
  });

  it("can be used once", async () => {
    const { ours, admin } = await fixture();
    const { token } = await suppliers.createSupplierUser({
      email: `once-${counter++}@example.test`,
      name: null,
      brandId: ours.id,
      invitedById: admin.id,
    });

    assert.equal(await suppliers.setPasswordWithToken(token, "ett-langt-losenord"), true);
    assert.equal(
      await suppliers.setPasswordWithToken(token, "ett-annat-langt-losen"),
      false,
      "the second use must fail"
    );
  });

  it("expires", async () => {
    const { ours, admin } = await fixture();
    const { id, token } = await suppliers.createSupplierUser({
      email: `old-${counter++}@example.test`,
      name: null,
      brandId: ours.id,
      invitedById: admin.id,
    });

    await prisma.supplierUser.update({
      where: { id },
      data: { inviteExpiresAt: new Date(Date.now() - 1000) },
    });

    const lookup = await suppliers.lookupToken(token);
    assert.equal(lookup.ok, false);
    assert.equal(await suppliers.setPasswordWithToken(token, "ett-langt-losenord"), false);
  });

  it("refuses a second account on the same address", async () => {
    const { ours, admin } = await fixture();
    const email = `dupe-${counter++}@example.test`;
    await suppliers.createSupplierUser({ email, name: null, brandId: ours.id, invitedById: admin.id });

    await assert.rejects(
      suppliers.createSupplierUser({ email, name: null, brandId: ours.id, invitedById: admin.id }),
      /redan ett konto/
    );
  });
});

describe("brand isolation in the figures", () => {
  async function withSales() {
    const context = await fixture();
    await sales.importSales({
      lines: [
        {
          date: "2026-11-02",
          storeName: context.storeA.name,
          sku: context.ourProduct.sku,
          quantity: 3,
          grossAmount: 150,
        },
        {
          date: "2026-11-02",
          storeName: context.storeA.name,
          sku: context.theirProduct.sku,
          quantity: 7,
          grossAmount: 350,
        },
      ],
      source: "test",
      fileName: null,
      createdById: null,
    });
    return context;
  }

  it("returns one brand's rows and nothing else", async () => {
    const { ours, theirs, ourProduct, theirProduct } = await withSales();

    const mine = await sales.getBrandSales({ brandId: ours.id, from: "2026-11-01", to: "2026-11-30" });
    assert.equal(mine.length, 1);
    assert.equal(mine[0].quantity, 3);

    const others = await sales.getBrandSales({
      brandId: theirs.id,
      from: "2026-11-01",
      to: "2026-11-30",
    });
    assert.equal(others[0].quantity, 7);

    // Every row that came back is ours, and the other brand's product is not
    // among them under any name.
    assert.ok(
      mine.every((row) => row.productId === ourProduct.id),
      "every row must belong to this brand's own product"
    );
    assert.ok(
      !mine.some((row) => row.productId === theirProduct.id),
      "the other brand's product must not appear at all"
    );
  });

  it("gives an unknown brand nothing rather than everything", async () => {
    await withSales();
    const rows = await sales.getBrandSales({
      brandId: "no-such-brand",
      from: "2026-11-01",
      to: "2026-11-30",
    });
    assert.deepEqual(rows, []);
  });

  it("respects the date range", async () => {
    const { ours } = await withSales();
    assert.deepEqual(
      await sales.getBrandSales({ brandId: ours.id, from: "2026-12-01", to: "2026-12-31" }),
      []
    );
  });
});

describe("importing sales", () => {
  it("replaces a day instead of doubling it", async () => {
    const { ours, storeA, ourProduct } = await fixture();
    const line = {
      date: "2026-11-02",
      storeName: storeA.name,
      sku: ourProduct.sku,
      quantity: 4,
      grossAmount: 200,
    };

    await sales.importSales({ lines: [line], source: "test", fileName: null, createdById: null });
    await sales.importSales({ lines: [line], source: "test", fileName: null, createdById: null });

    const rows = await sales.getBrandSales({
      brandId: ours.id,
      from: "2026-11-01",
      to: "2026-11-30",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quantity, 4, "the same file twice is the same figure, not double");
  });

  it("adds up two tills on the same day", async () => {
    const { ours, storeA, ourProduct } = await fixture();
    await sales.importSales({
      lines: [
        { date: "2026-11-02", storeName: storeA.name, sku: ourProduct.sku, quantity: 2 },
        { date: "2026-11-02", storeName: storeA.name, sku: ourProduct.sku, quantity: 3 },
      ],
      source: "test",
      fileName: null,
      createdById: null,
    });

    const rows = await sales.getBrandSales({ brandId: ours.id, from: "2026-11-01", to: "2026-11-30" });
    assert.equal(rows[0].quantity, 5);
  });

  it("matches on EAN as well as article number", async () => {
    const { ours, storeA, ourProduct } = await fixture();
    await sales.importSales({
      lines: [
        { date: "2026-11-03", storeName: storeA.name, ean: ourProduct.eanKfp, quantity: 6 },
      ],
      source: "test",
      fileName: null,
      createdById: null,
    });
    const rows = await sales.getBrandSales({ brandId: ours.id, from: "2026-11-01", to: "2026-11-30" });
    assert.equal(rows[0].quantity, 6);
  });

  it("parks a row it cannot match rather than dropping it", async () => {
    const { storeA } = await fixture();
    const result = await sales.importSales({
      lines: [
        { date: "2026-11-02", storeName: storeA.name, sku: "INGEN-SADAN", quantity: 9 },
        { date: "2026-11-02", storeName: "Butik som inte finns", sku: "X", quantity: 1 },
      ],
      source: "test",
      fileName: null,
      createdById: null,
    });

    assert.equal(result.rowsStored, 0);
    assert.equal(result.rowsUnmatched, 2);
    assert.deepEqual(result.unknownStores, ["Butik som inte finns"]);
    assert.ok((await sales.listUnmatched()).length >= 2);
  });

  it("puts a resolved row back into the right day", async () => {
    const { ours, storeA, ourProduct } = await fixture();
    await sales.importSales({
      lines: [{ date: "2026-11-04", storeName: storeA.name, sku: "OKAND", quantity: 5 }],
      source: "test",
      fileName: null,
      createdById: null,
    });

    const [orphan] = await sales.listUnmatched();
    assert.equal(await sales.resolveUnmatched({ id: orphan.id, productId: ourProduct.id }), true);

    const rows = await sales.getBrandSales({ brandId: ours.id, from: "2026-11-04", to: "2026-11-04" });
    assert.equal(rows[0].quantity, 5);
    assert.equal(
      await sales.resolveUnmatched({ id: orphan.id, productId: ourProduct.id }),
      false,
      "resolving twice must not add the figure twice"
    );
  });
});

describe("demo days", () => {
  it("lets one store be booked once a day, and frees it on a decline", async () => {
    const { ours, theirs, storeA, supplier } = await fixture();
    const date = "2026-12-10";

    const first = await demoDays.createBookings({
      brandId: ours.id,
      supplierUserId: supplier.id,
      date,
      storeIds: [storeA.id],
      note: null,
    });
    assert.equal(first.created.length, 1);

    // A second brand asking for the same shop on the same day is told the
    // slot is taken, and told nothing about who has it.
    await assert.rejects(
      demoDays.createBookings({
        brandId: theirs.id,
        supplierUserId: supplier.id,
        date,
        storeIds: [storeA.id],
        note: null,
      }),
      (error: Error) => {
        assert.match(error.message, /Redan bokad/);
        assert.ok(!error.message.includes(ours.name), "must not name the other brand");
        return true;
      }
    );

    // Declined frees the day.
    const [booking] = await demoDays.listBookingsForBrand({ brandId: ours.id });
    const admin = await prisma.user.create({
      data: { email: `dec-${counter++}@example.test`, hashedPassword: "x", role: "ADMIN" },
      select: { id: true },
    });
    await demoDays.decide({ id: booking.id, to: "DECLINED", userId: admin.id, note: null });

    const second = await demoDays.createBookings({
      brandId: theirs.id,
      supplierUserId: supplier.id,
      date,
      storeIds: [storeA.id],
      note: null,
    });
    assert.equal(second.created.length, 1);
  });

  it("books the stores it can and reports the ones it cannot", async () => {
    const { ours, theirs, storeA, storeB, supplier } = await fixture();
    const date = "2026-12-11";

    await demoDays.createBookings({
      brandId: theirs.id,
      supplierUserId: supplier.id,
      date,
      storeIds: [storeA.id],
      note: null,
    });

    const result = await demoDays.createBookings({
      brandId: ours.id,
      supplierUserId: supplier.id,
      date,
      storeIds: [storeA.id, storeB.id],
      note: null,
    });

    assert.deepEqual(result.created.map((row) => row.storeId), [storeB.id]);
    assert.deepEqual(result.skipped.map((row) => row.reason), ["Redan bokad"]);
    assert.ok(result.groupId, "the stores booked together share a group");
  });

  it("will not book a closed day", async () => {
    const { ours, storeA, supplier } = await fixture();
    await hours.saveException({
      storeId: storeA.id,
      date: "2026-12-24",
      closed: true,
      opensAt: null,
      closesAt: null,
      note: "Julafton",
    });

    const options = await demoDays.storeOptionsForDate("2026-12-24");
    const option = options.find((candidate) => candidate.storeId === storeA.id);
    assert.equal(option?.blockedReason, "Stängt den dagen");

    await assert.rejects(
      demoDays.createBookings({
        brandId: ours.id,
        supplierUserId: supplier.id,
        date: "2026-12-24",
        storeIds: [storeA.id],
        note: null,
      }),
      /Stängt den dagen/
    );
  });

  it("takes the shop's own opening hours as the times", async () => {
    const { ours, storeA, supplier } = await fixture();
    await demoDays.createBookings({
      brandId: ours.id,
      supplierUserId: supplier.id,
      date: "2026-12-12",
      storeIds: [storeA.id],
      note: null,
    });
    const [booking] = await demoDays.listBookingsForBrand({ brandId: ours.id });
    assert.deepEqual([booking.startsAt, booking.endsAt], ["10:00", "18:00"]);
  });

  it("lets exactly one of two simultaneous answers land", async () => {
    const { ours, storeA, supplier, admin } = await fixture();
    await demoDays.createBookings({
      brandId: ours.id,
      supplierUserId: supplier.id,
      date: "2026-12-13",
      storeIds: [storeA.id],
      note: null,
    });
    const [booking] = await demoDays.listBookingsForBrand({ brandId: ours.id });

    const results = await Promise.allSettled([
      demoDays.decide({ id: booking.id, to: "CONFIRMED", userId: admin.id, note: null }),
      demoDays.decide({ id: booking.id, to: "DECLINED", userId: admin.id, note: null }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  });

  it("only lets a supplier cancel their own brand's booking", async () => {
    const { ours, theirs, storeA, supplier } = await fixture();
    await demoDays.createBookings({
      brandId: ours.id,
      supplierUserId: supplier.id,
      date: "2026-12-14",
      storeIds: [storeA.id],
      note: null,
    });
    const [booking] = await demoDays.listBookingsForBrand({ brandId: ours.id });

    assert.equal(
      await demoDays.cancelBySupplier({ id: booking.id, brandId: theirs.id }),
      false,
      "another brand must not be able to cancel it"
    );
    assert.equal(await demoDays.cancelBySupplier({ id: booking.id, brandId: ours.id }), true);
  });

  it("shows a brand only its own bookings", async () => {
    const { ours, theirs, storeA, storeB, supplier } = await fixture();
    await demoDays.createBookings({
      brandId: ours.id,
      supplierUserId: supplier.id,
      date: "2026-12-15",
      storeIds: [storeA.id],
      note: null,
    });
    await demoDays.createBookings({
      brandId: theirs.id,
      supplierUserId: supplier.id,
      date: "2026-12-15",
      storeIds: [storeB.id],
      note: null,
    });

    const mine = await demoDays.listBookingsForBrand({ brandId: ours.id });
    assert.equal(mine.length, 1);
    assert.equal(mine[0].brand.id, ours.id);
  });
});

describe("pauses, read from the database", () => {
  it("applies to the store it names and no other", async () => {
    const { storeA, storeB, admin } = await fixture();
    await pauses.createPause({
      scope: "STORE",
      storeId: storeA.id,
      brandId: null,
      startsAt: new Date(Date.now() - 1000),
      endsAt: null,
      message: "Inventering",
      createdById: admin.id,
    });

    assert.equal((await pauses.activePausesFor({ storeId: storeA.id })).length, 1);
    assert.equal((await pauses.activePausesFor({ storeId: storeB.id })).length, 0);
  });

  it("stops applying the moment it is lifted", async () => {
    const { storeA, admin } = await fixture();
    const id = await pauses.createPause({
      scope: "ALL",
      storeId: null,
      brandId: null,
      startsAt: new Date(Date.now() - 1000),
      endsAt: null,
      message: "Stopp",
      createdById: admin.id,
    });

    assert.ok((await pauses.activePausesFor({ storeId: storeA.id })).length > 0);
    await pauses.liftPause({ id, userId: admin.id });
    assert.deepEqual(await pauses.activePausesFor({ storeId: storeA.id }), []);

    // The row stays, so the history can still answer "why last Tuesday".
    const history = await pauses.listPauseHistory();
    assert.ok(history.some((pause) => pause.id === id && pause.liftedAt !== null));
  });

  it("logs an override against the pause it went round", async () => {
    const { storeA, admin } = await fixture();
    const id = await pauses.createPause({
      scope: "ALL",
      storeId: null,
      brandId: null,
      startsAt: new Date(Date.now() - 1000),
      endsAt: null,
      message: "Stopp",
      createdById: admin.id,
    });

    await pauses.recordOverride({
      pauseId: id,
      userId: admin.id,
      storeId: storeA.id,
      orderId: null,
      reason: "Akut, överenskommet",
    });

    const overrides = await pauses.listOverrides(id);
    assert.equal(overrides.length, 1);
    assert.equal(overrides[0].reason, "Akut, överenskommet");
  });
});
