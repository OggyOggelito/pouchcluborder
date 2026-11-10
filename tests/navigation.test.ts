import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ADMIN_ENTRIES,
  NAV_ENTRIES,
  activeHref,
  adminSections,
  bottomBarFor,
  groupedNavFor,
  navFor,
  roleMaySee,
  searchablePagesFor,
} from "../src/config/navigation";
import { ALL_FEATURES, NO_FEATURES, type Features } from "../src/lib/feature-keys";
import { ROLES, type Role } from "../src/lib/roles";

const ALL_ON: Features = ALL_FEATURES;

describe("navigation per role", () => {
  it("offers no admin destination to STAFF or OWNER", () => {
    for (const role of ["STAFF", "OWNER"] as const) {
      const hrefs = navFor(role, ALL_ON).map((entry) => entry.href);
      assert.ok(
        !hrefs.some((href) => href.startsWith("/admin")),
        `${role} should see no /admin link, got ${hrefs.join(", ")}`
      );

      const searchable = searchablePagesFor(role, ALL_ON).map((page) => page.href);
      assert.ok(
        !searchable.some((href) => href.startsWith("/admin")),
        `${role} should not find /admin pages in search`
      );
    }
  });

  it("offers the admin area to ADMIN, in search too", () => {
    const hrefs = navFor("ADMIN", ALL_ON).map((entry) => entry.href);
    assert.ok(hrefs.includes("/admin"));

    const searchable = searchablePagesFor("ADMIN", ALL_ON).map((page) => page.href);
    for (const entry of ADMIN_ENTRIES.filter((candidate) => candidate.searchable)) {
      assert.ok(searchable.includes(entry.href), `${entry.href} should be searchable for ADMIN`);
    }
  });

  it("lets STAFF read a schedule but never write one or see other stores", () => {
    const staff = navFor("STAFF", ALL_ON).map((entry) => entry.href);
    assert.ok(staff.includes("/schedule"), "STAFF see their own schedule");
    for (const href of [
      "/store/schedule",
      "/schedule/available",
      "/schedule/extra",
      "/store/employees",
    ]) {
      assert.ok(!staff.includes(href), `STAFF must not be offered ${href}`);
    }

    for (const role of ["OWNER", "ADMIN"] as const) {
      const hrefs = navFor(role, ALL_ON).map((entry) => entry.href);
      for (const href of [
        "/schedule",
        "/store/schedule",
        "/schedule/available",
        "/schedule/extra",
        "/store/employees",
      ]) {
        assert.ok(hrefs.includes(href), `${role} should be offered ${href}`);
      }
    }
  });

  it("no longer offers the old schedule addresses", () => {
    // They still work — they redirect. But a menu pointing at a redirect is a
    // menu that lies about where you are going.
    const hrefs = NAV_ENTRIES.map((entry) => entry.href);
    assert.ok(!hrefs.includes("/my-schedule"));
    assert.ok(!hrefs.includes("/team-schedule"));
  });

  it("keeps ordering away from STAFF", () => {
    const staff = navFor("STAFF", ALL_ON).map((entry) => entry.href);
    assert.ok(!staff.includes("/order"), "STAFF cannot place orders");
    assert.ok(!staff.includes("/orders"), "STAFF cannot see order history");

    for (const role of ["OWNER", "ADMIN"] as const) {
      assert.ok(navFor(role, ALL_ON).map((entry) => entry.href).includes("/order"));
    }
  });

  it("shows a signed-out visitor only the public pages", () => {
    const hrefs = navFor(null, ALL_ON).map((entry) => entry.href);
    assert.deepEqual(new Set(hrefs), new Set(["/staff", "/staff/finder"]));

    for (const entry of NAV_ENTRIES) {
      if (entry.publicAccess) continue;
      assert.equal(roleMaySee(entry, null), false, `${entry.href} must not be public`);
    }
  });

  it("gives every signed-in role a home and never more than four bottom-bar items", () => {
    for (const role of ROLES) {
      const bar = bottomBarFor(role, ALL_ON);
      assert.ok(bar.length > 0 && bar.length <= 4, `${role} bottom bar was ${bar.length}`);
      assert.equal(bar[0]?.href, "/", `${role} should start at Idag`);
    }
  });

  it("never nests deeper than two levels", () => {
    // "At most two levels deep": /store/notes is fine, /a/b/c is not.
    for (const entry of NAV_ENTRIES) {
      const depth = entry.href.split("/").filter(Boolean).length;
      assert.ok(depth <= 2, `${entry.href} is ${depth} levels deep`);
    }
  });
});

describe("feature flags hide, they do not protect", () => {
  const nothingOn: Features = NO_FEATURES;

  it("drops a module from every menu when its flag is off", () => {
    const hrefs = navFor("OWNER", nothingOn).map((entry) => entry.href);
    assert.ok(!hrefs.includes("/order"), "ordering off should hide /order");
    assert.ok(!hrefs.includes("/news"), "news off should hide /news");
    assert.ok(!hrefs.includes("/schedule"), "schedule off should hide the schedule");
    assert.ok(!hrefs.includes("/store/schedule"), "schedule off should hide the week grid");
    assert.ok(!hrefs.includes("/staff/quizzes"), "no published quiz should hide the quiz");
  });

  it("keeps the unflagged essentials whatever is switched off", () => {
    const hrefs = navFor("OWNER", nothingOn).map((entry) => entry.href);
    for (const href of ["/", "/settings", "/notifications", "/store/notes"]) {
      assert.ok(hrefs.includes(href), `${href} has no flag and must always show`);
    }
  });

  it("a hidden entry is still a real route — visibility is not permission", () => {
    // The point of the assertion: nothing in this config grants or denies
    // access. Pages check the session themselves; see tests/permissions.
    const hidden = navFor("STAFF", nothingOn);
    const everything = NAV_ENTRIES.map((entry) => entry.href);
    for (const entry of hidden) {
      assert.ok(everything.includes(entry.href));
    }
  });
});

describe("active state", () => {
  const entries = navFor("ADMIN", ALL_ON);

  it("matches the deepest registered route", () => {
    assert.equal(activeHref("/store/issues/new", entries), "/store/issues");
    assert.equal(activeHref("/schedule/available", entries), "/schedule/available");
    assert.equal(activeHref("/schedule/extra/abc123", entries), "/schedule/extra");
    assert.equal(activeHref("/store/schedule/copy", entries), "/store/schedule");
    assert.equal(activeHref("/staff/finder", entries), "/staff/finder");
    assert.equal(activeHref("/staff/brands/zyn", entries), "/staff");
  });

  it("never lets the home entry own the whole app", () => {
    assert.equal(activeHref("/", entries), "/");
    assert.equal(activeHref("/order", entries), "/order");
    assert.equal(activeHref("/news", entries), "/news");
  });

  it("returns null for a route nothing registers", () => {
    assert.equal(activeHref("/login", entries), null);
  });
});

describe("admin hub", () => {
  it("drops the dormant TooEasy cards while the integration is off", () => {
    const off: Features = { ...ALL_FEATURES, tooeasy: false };
    const hrefs = adminSections(off).flatMap((section) =>
      section.entries.map((entry) => entry.href)
    );
    assert.ok(!hrefs.includes("/admin/tooeasy"), "the mapping page should leave the hub");
    assert.ok(hrefs.includes("/admin/schedule"), "the schedule page stays");

    const searchable = searchablePagesFor("ADMIN", off).map((page) => page.href);
    assert.ok(
      !searchable.includes("/admin/tooeasy"),
      "and must not be findable through search either"
    );

    // Switched on, it comes straight back — nothing was deleted.
    const on = adminSections(ALL_ON).flatMap((section) =>
      section.entries.map((entry) => entry.href)
    );
    assert.ok(on.includes("/admin/tooeasy"));
  });

  it("files every admin page under exactly one job", () => {
    const grouped = adminSections().flatMap((section) => section.entries);
    assert.equal(grouped.length, ADMIN_ENTRIES.length);
    assert.equal(new Set(grouped.map((entry) => entry.href)).size, ADMIN_ENTRIES.length);
  });

  it("points every card at an /admin route", () => {
    for (const entry of ADMIN_ENTRIES) {
      assert.ok(entry.href.startsWith("/admin/"), `${entry.href} is not an admin route`);
      assert.ok(entry.description.length > 0, `${entry.href} needs a description`);
    }
  });
});

describe("grouping", () => {
  it("drops empty groups rather than rendering a bare heading", () => {
    const sections = groupedNavFor("STAFF", ALL_ON);
    assert.ok(sections.every((section) => section.entries.length > 0));
    assert.ok(
      !sections.some((section) => section.group === "admin"),
      "STAFF should have no admin group at all"
    );
  });

  it("lists every visible entry exactly once across the groups", () => {
    for (const role of ROLES as readonly Role[]) {
      const visible = navFor(role, ALL_ON).map((entry) => entry.href).sort();
      const grouped = groupedNavFor(role, ALL_ON)
        .flatMap((section) => section.entries)
        .map((entry) => entry.href)
        .sort();
      assert.deepEqual(grouped, visible, `${role} lost or duplicated an entry`);
    }
  });
});

describe("every registered route exists on disk", () => {
  /**
   * The menu is generated from config, so a route renamed without updating
   * the config produces a link straight to a 404 — and nothing else would
   * catch it. `[param]` segments are matched by shape.
   */
  function pageFileFor(href: string): string | null {
    const segments = href.split("/").filter(Boolean);
    let dir = path.join(process.cwd(), "src", "app");

    for (const segment of segments) {
      const direct = path.join(dir, segment);
      if (existsSync(direct)) {
        dir = direct;
        continue;
      }
      const dynamic = readdirSync(dir).find(
        (entry) => entry.startsWith("[") && entry.endsWith("]")
      );
      if (!dynamic) return null;
      dir = path.join(dir, dynamic);
    }

    const file = path.join(dir, "page.tsx");
    return existsSync(file) ? file : null;
  }

  it("has a page for every navigation entry", () => {
    for (const entry of NAV_ENTRIES) {
      assert.ok(pageFileFor(entry.href), `${entry.href} has no page.tsx`);
    }
  });

  it("has a page for every admin hub card", () => {
    for (const entry of ADMIN_ENTRIES) {
      assert.ok(pageFileFor(entry.href), `${entry.href} has no page.tsx`);
    }
  });

  it("still serves the order form, at its new address", () => {
    // It lived at "/" until the portal grew a role-aware home. "/" is now
    // Idag — which is what the brief asks for, so there is nothing to
    // redirect to: the home page's primary button is the way in.
    assert.ok(pageFileFor("/order"), "the order form must exist at /order");
    assert.ok(pageFileFor("/"), "/ must still serve something");
    assert.ok(
      NAV_ENTRIES.some((entry) => entry.href === "/order"),
      "/ was never in the nav config; /order must be"
    );
  });
});
