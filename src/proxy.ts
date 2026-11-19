import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic redirects only.
 *
 * This checks whether a session cookie is present, nothing more — it does not
 * verify one. The Next docs warn against using proxy as an authorization
 * layer, so the real checks live in src/lib/session.ts and
 * src/lib/supplier-session.ts and run on every protected page and route.
 * This exists so a signed-out visitor is sent to the right login without
 * rendering a page first.
 *
 * `/` is deliberately absent: it is the entry page now, and it is public.
 * `/staff` and `/login` are absent for the same reason as before — the brand
 * guide is open to everyone.
 */
const STAFF_SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

const SUPPLIER_SESSION_COOKIES = [
  "pc-supplier.session-token",
  "__Secure-pc-supplier.session-token",
];

/** Reachable without a supplier session, because they are how you get one. */
const PUBLIC_SUPPLIER_PATHS = ["/supplier/login", "/supplier/aktivera", "/supplier/api"];

function has(request: NextRequest, names: string[]): boolean {
  return names.some((name) => request.cookies.has(name));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/supplier" || pathname.startsWith("/supplier/")) {
    if (PUBLIC_SUPPLIER_PATHS.some((path) => pathname.startsWith(path))) {
      return NextResponse.next();
    }
    // A staff session here is answered by the layout with a plain notice, not
    // by a redirect: bouncing somebody to a login they are already signed in
    // to is a loop, and the notice is what tells them why.
    if (has(request, STAFF_SESSION_COOKIES)) return NextResponse.next();
    if (has(request, SUPPLIER_SESSION_COOKIES)) return NextResponse.next();

    const login = new URL("/supplier/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (has(request, STAFF_SESSION_COOKIES)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

/**
 * Every signed-in staff area, plus the whole supplier portal.
 *
 * `/`, `/login` and `/staff/*` are absent: the entry page and the brand guide
 * are public. Widened from the two paths it used to cover so that a wrong
 * session gets a real 307 to the right login rather than a streamed redirect
 * inside a 200 — same outcome, but visible to anything that is not a browser.
 */
export const config = {
  matcher: [
    "/idag",
    "/admin/:path*",
    "/my-onboarding",
    "/news",
    "/notifications",
    "/order",
    "/orders/:path*",
    "/requests/:path*",
    "/schedule/:path*",
    "/settings",
    "/store/:path*",
    "/transfers/:path*",
    "/supplier/:path*",
  ],
};
