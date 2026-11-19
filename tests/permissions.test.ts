import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ROLES,
  canAccessAdmin,
  canAccessAllStores,
  canActOnStore,
  canArchiveNotes,
  canDeleteNotes,
  canDecideDemoDays,
  canEditOpeningHours,
  canEditRoutines,
  canEditSchedule,
  canManageEmployees,
  canManageIssues,
  canManageNearbyStores,
  canManageSuppliers,
  canOverrideOrderPause,
  canPauseOrders,
  canViewSalesStats,
  canPlaceOrders,
  canViewAvailability,
  canViewTeamSchedule,
  toRole,
  visibleStoreIds,
  type Role,
} from "../src/lib/roles";

describe("role capabilities", () => {
  /** The whole permission model in one table. */
  const MATRIX: Record<Role, {
    allStores: boolean;
    order: boolean;
    teamSchedule: boolean;
    admin: boolean;
    archiveNotes: boolean;
    deleteNotes: boolean;
    manageIssues: boolean;
    editRoutines: boolean;
    editSchedule: boolean;
    manageEmployees: boolean;
    viewAvailability: boolean;
    editOpeningHours: boolean;
    manageNearby: boolean;
    manageSuppliers: boolean;
    decideDemoDays: boolean;
    pauseOrders: boolean;
  }> = {
    STAFF: {
      allStores: false,
      order: false,
      teamSchedule: false,
      admin: false,
      archiveNotes: false,
      deleteNotes: false,
      manageIssues: false,
      editRoutines: false,
      editSchedule: false,
      manageEmployees: false,
      viewAvailability: false,
      editOpeningHours: false,
      manageNearby: false,
      manageSuppliers: false,
      decideDemoDays: false,
      pauseOrders: false,
    },
    OWNER: {
      allStores: false,
      order: true,
      teamSchedule: true,
      admin: false,
      archiveNotes: true,
      deleteNotes: false,
      manageIssues: false,
      editRoutines: false,
      editSchedule: true,
      manageEmployees: true,
      viewAvailability: true,
      editOpeningHours: true,
      manageNearby: false,
      manageSuppliers: false,
      decideDemoDays: true,
      pauseOrders: false,
    },
    ADMIN: {
      allStores: true,
      order: true,
      teamSchedule: true,
      admin: true,
      archiveNotes: true,
      deleteNotes: true,
      manageIssues: true,
      editRoutines: true,
      editSchedule: true,
      manageEmployees: true,
      viewAvailability: true,
      editOpeningHours: true,
      manageNearby: true,
      manageSuppliers: true,
      decideDemoDays: true,
      pauseOrders: true,
    },
  };

  it("matches the intended capability matrix exactly", () => {
    for (const role of ROLES) {
      const expected = MATRIX[role];
      assert.equal(canAccessAllStores(role), expected.allStores, `${role} allStores`);
      assert.equal(canPlaceOrders(role), expected.order, `${role} order`);
      assert.equal(canViewTeamSchedule(role), expected.teamSchedule, `${role} teamSchedule`);
      assert.equal(canAccessAdmin(role), expected.admin, `${role} admin`);
      assert.equal(canArchiveNotes(role), expected.archiveNotes, `${role} archiveNotes`);
      assert.equal(canDeleteNotes(role), expected.deleteNotes, `${role} deleteNotes`);
      assert.equal(canManageIssues(role), expected.manageIssues, `${role} manageIssues`);
      assert.equal(canEditRoutines(role), expected.editRoutines, `${role} editRoutines`);
      assert.equal(canEditSchedule(role), expected.editSchedule, `${role} editSchedule`);
      assert.equal(canManageEmployees(role), expected.manageEmployees, `${role} manageEmployees`);
      assert.equal(
        canViewAvailability(role),
        expected.viewAvailability,
        `${role} viewAvailability`
      );
      assert.equal(
        canEditOpeningHours(role),
        expected.editOpeningHours,
        `${role} editOpeningHours`
      );
      assert.equal(
        canManageNearbyStores(role),
        expected.manageNearby,
        `${role} manageNearby`
      );
      assert.equal(canManageSuppliers(role), expected.manageSuppliers, `${role} manageSuppliers`);
      assert.equal(canDecideDemoDays(role), expected.decideDemoDays, `${role} decideDemoDays`);
      assert.equal(canPauseOrders(role), expected.pauseOrders, `${role} pauseOrders`);
      assert.equal(
        canOverrideOrderPause(role),
        expected.pauseOrders,
        `${role} overrideOrderPause`
      );
    }
  });

  it("needs both the role and the permission to read a supplier's figures", () => {
    // The sales figures are a supplier's commercial data. The ADMIN role is
    // necessary and not sufficient: the per-account flag has to be on too, and
    // it is off by default.
    assert.equal(canViewSalesStats({ role: "ADMIN", canViewStats: true }), true);
    assert.equal(canViewSalesStats({ role: "ADMIN", canViewStats: false }), false);
    assert.equal(canViewSalesStats({ role: "OWNER", canViewStats: true }), false);
    assert.equal(canViewSalesStats({ role: "STAFF", canViewStats: true }), false);
  });

  it("keeps supplier accounts out of the staff role list entirely", async () => {
    // SUPPLIER is not a staff role and must never appear in the admin role
    // picker — a supplier is an external person in a separate table, not a
    // staff account with fewer rights.
    const { ROLES: staffRoles } = await import("../src/lib/roles");
    assert.ok(!(staffRoles as readonly string[]).includes("SUPPLIER"));
  });

  it("lets an OWNER run their own schedule but not decide who sees whose staff", () => {
    // Entering shifts and managing a staff list is a store's own business.
    // Which stores may see each other's free employees is not — it decides
    // who sees whose people, so it stays with an ADMIN.
    assert.equal(canEditSchedule("OWNER"), true);
    assert.equal(canManageEmployees("OWNER"), true);
    assert.equal(canEditOpeningHours("OWNER"), true);
    assert.equal(canManageNearbyStores("OWNER"), false);
  });

  it("keeps STAFF out of the schedule, the staff list and the cross-store view", () => {
    // STAFF read their own shifts and their own store's week. They do not
    // write, and they never see another store's employees.
    assert.equal(canEditSchedule("STAFF"), false);
    assert.equal(canManageEmployees("STAFF"), false);
    assert.equal(canViewAvailability("STAFF"), false);
    assert.equal(canEditOpeningHours("STAFF"), false);
  });

  it("lets an OWNER archive a shift note but never delete one", () => {
    // Archiving is how an IMPORTANT handover comes off the top of the feed, so
    // a shift manager needs it. Deleting is the only destructive action in the
    // feature and stays with an ADMIN.
    assert.equal(canArchiveNotes("OWNER"), true);
    assert.equal(canDeleteNotes("OWNER"), false);
  });

  it("keeps STAFF out of archiving, the issue queue and the routine editor", () => {
    assert.equal(canArchiveNotes("STAFF"), false);
    assert.equal(canDeleteNotes("STAFF"), false);
    assert.equal(canManageIssues("STAFF"), false);
    assert.equal(canEditRoutines("STAFF"), false);
  });

  it("keeps STAFF out of ordering, the team grid and admin", () => {
    assert.equal(canPlaceOrders("STAFF"), false);
    assert.equal(canViewTeamSchedule("STAFF"), false);
    assert.equal(canAccessAdmin("STAFF"), false);
  });

  it("falls back to the least privileged role for unknown values", () => {
    for (const value of ["SUPERUSER", "", null, undefined, 42, {}]) {
      assert.equal(toRole(value), "STAFF", `${String(value)} should fall back to STAFF`);
    }
    // and a real role survives the round trip
    for (const role of ROLES) assert.equal(toRole(role), role);
  });

  it("lists STAFF first, so it is the default in the admin form", () => {
    assert.equal(ROLES[0], "STAFF");
  });
});

describe("store scoping", () => {
  const own = ["store-a"];
  const all = ["store-a", "store-b", "store-c"];

  it("gives an ADMIN every store and everyone else only their own", () => {
    assert.deepEqual(visibleStoreIds("ADMIN", own, all), all);
    assert.deepEqual(visibleStoreIds("OWNER", own, all), own);
    assert.deepEqual(visibleStoreIds("STAFF", own, all), own);
  });

  it("does not let a non-admin act on a store they lack access to", () => {
    assert.equal(canActOnStore("OWNER", own, "store-a"), true);
    assert.equal(canActOnStore("OWNER", own, "store-b"), false);
    assert.equal(canActOnStore("STAFF", own, "store-b"), false);
    // An admin may act on any store, including one not in their access rows.
    assert.equal(canActOnStore("ADMIN", [], "store-b"), true);
  });

  it("returns a copy, so a caller cannot mutate the caller's store list", () => {
    const result = visibleStoreIds("OWNER", own, all);
    result.push("store-z");
    assert.deepEqual(own, ["store-a"]);
  });

  it("gives an account with no stores nothing to act on", () => {
    assert.deepEqual(visibleStoreIds("STAFF", [], all), []);
    assert.equal(canActOnStore("STAFF", [], "store-a"), false);
  });
});
