import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic redirect only.
 *
 * This checks for the presence of a session cookie, nothing more — it does not
 * verify it. The Next docs warn against using proxy as an authorization layer,
 * so the real check lives in src/lib/session.ts and runs on every protected
 * page. This exists so a signed-out user gets sent to /login without rendering
 * the order page first.
 *
 * /staff and /login are deliberately absent from the matcher: the knowledge
 * dashboard is open to everyone.
 */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function proxy(request: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSessionCookie) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/", "/orders/:path*"],
};
