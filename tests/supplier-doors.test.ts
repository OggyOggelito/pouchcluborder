import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import {
  SUPPLIER_COOKIE_PATH,
  SUPPLIER_SESSION_COOKIE,
} from "../src/supplier-auth";

/**
 * The two doors.
 *
 * `proxy` is a pure function of a request, so the whole routing matrix can be
 * asserted here without a server: which cookie reaches which path, and where
 * each wrong combination is sent.
 *
 * It is not the only check — every page and query checks again — but it is the
 * one that can be exhaustively enumerated.
 */
const STAFF_COOKIE = "authjs.session-token";

function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const req = new NextRequest(`http://localhost:3000${path}`);
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

function destination(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname + new URL(location).search : null;
}

const STAFF_ROUTES = [
  "/idag",
  "/admin",
  "/admin/users",
  "/admin/stats",
  "/order",
  "/orders",
  "/store/schedule",
  "/store/demo-days",
  "/settings",
  "/notifications",
  "/transfers",
];

describe("the supplier session cannot reach the staff app", () => {
  it("sends a request carrying only the supplier cookie to the staff login", () => {
    for (const route of STAFF_ROUTES) {
      const response = proxy(request(route, { [SUPPLIER_SESSION_COOKIE]: "x" }));
      assert.equal(
        destination(response),
        `/login?next=${encodeURIComponent(route)}`,
        `${route} should bounce to the staff login`
      );
    }
  });

  it("is in fact scoped so the browser never sends it there at all", () => {
    // Belt and braces, and the braces are the stronger half: the cookie is
    // pinned to /supplier, so the case above is one a browser cannot even
    // produce. The test asserts the configuration that makes that true.
    assert.equal(SUPPLIER_COOKIE_PATH, "/supplier");
    assert.match(SUPPLIER_SESSION_COOKIE, /^(__Secure-)?pc-supplier\.session-token$/);
    assert.notEqual(SUPPLIER_SESSION_COOKIE, STAFF_COOKIE);
  });

  it("sends a signed-out request to the staff login too", () => {
    const response = proxy(request("/idag"));
    assert.equal(destination(response), "/login?next=%2Fidag");
  });

  it("keeps the query string, so the login can send them back", () => {
    const response = proxy(request("/orders/abc?filter=1", { }));
    assert.equal(destination(response), "/login?next=%2Forders%2Fabc%3Ffilter%3D1");
  });
});

describe("the staff session does not sign anybody into the supplier app", () => {
  it("lets the request through to the layout, which shows the notice", () => {
    // Not a redirect: bouncing a signed-in staff user to a login they are
    // already past is a loop. The layout answers with a plain page instead,
    // and that page contains no data.
    const response = proxy(request("/supplier", { [STAFF_COOKIE]: "x" }));
    assert.equal(destination(response), null);
  });

  it("does not treat the staff cookie as a supplier session on a deep page", () => {
    const response = proxy(request("/supplier/stats", { [STAFF_COOKIE]: "x" }));
    assert.equal(destination(response), null, "the layout decides, not the proxy");
  });
});

describe("the supplier portal's own doors stay open", () => {
  it("sends a signed-out visitor to the supplier login, never the staff one", () => {
    for (const route of ["/supplier", "/supplier/boka", "/supplier/stats"]) {
      const response = proxy(request(route));
      assert.equal(
        destination(response),
        `/supplier/login?next=${encodeURIComponent(route)}`,
        `${route} should bounce to the supplier login`
      );
    }
  });

  it("never gates the pages you need in order to sign in", () => {
    for (const route of [
      "/supplier/login",
      "/supplier/aktivera",
      "/supplier/api/auth/csrf",
      "/supplier/api/auth/callback/credentials",
    ]) {
      assert.equal(destination(proxy(request(route))), null, `${route} must stay reachable`);
    }
  });

  it("lets a supplier session through its own portal", () => {
    const response = proxy(request("/supplier/boka", { [SUPPLIER_SESSION_COOKIE]: "x" }));
    assert.equal(destination(response), null);
  });
});

describe("the entry page is public", () => {
  it("is not in the matcher at all", async () => {
    const { config } = await import("../src/proxy");
    assert.ok(!config.matcher.includes("/"), "`/` is the front door and must stay public");
    assert.ok(config.matcher.includes("/supplier/:path*"));
    assert.ok(config.matcher.includes("/idag"));
  });

  it("covers every staff area it should", () => {
    // A route that is not matched still protects itself — every page calls
    // requireUser — but it answers with a streamed redirect inside a 200
    // rather than a 307. This keeps the list honest.
    const matcherPrefixes = ["/idag", "/admin", "/order", "/store", "/settings", "/transfers"];
    for (const prefix of matcherPrefixes) {
      const response = proxy(request(prefix));
      assert.ok(destination(response)?.startsWith("/login"), `${prefix} should redirect`);
    }
  });
});
