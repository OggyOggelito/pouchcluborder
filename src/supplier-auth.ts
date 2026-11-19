import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getSupplierForSignIn, normalizeEmail } from "@/lib/repositories/supplier-users";

/**
 * The supplier door.
 *
 * A second, complete Auth.js instance rather than a second provider on the
 * staff one. Two things follow from that, and both are the point:
 *
 * 1. **A different cookie, on a different path.** The supplier session cookie
 *    is scoped to `/supplier`, so a browser never sends it to a staff or admin
 *    route. A supplier session is not merely refused outside the supplier
 *    portal — it does not arrive there.
 *
 * 2. **A different lookup.** `authorize` reads `supplier_users` and nothing
 *    else. A supplier email typed into the staff form finds no row, and a
 *    staff email typed in here finds no row, so both get the same
 *    "Fel e-post eller lösenord" as any other wrong login.
 *
 * The staff cookie keeps its path of `/` and therefore does reach
 * `/supplier/*`. That is deliberate: it is how the portal can say "du är
 * inloggad som personal" instead of bouncing somebody into a login loop.
 */
const SECURE = process.env.NODE_ENV === "production";

/** `__Secure-` is only legal on a secure cookie, so the name follows the flag. */
function cookieName(suffix: string): string {
  return SECURE ? `__Secure-pc-supplier.${suffix}` : `pc-supplier.${suffix}`;
}

export const SUPPLIER_SESSION_COOKIE = cookieName("session-token");

/** The path every supplier cookie is pinned to. */
export const SUPPLIER_COOKIE_PATH = "/supplier";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: SUPPLIER_COOKIE_PATH,
  secure: SECURE,
};

export const {
  handlers: supplierHandlers,
  auth: supplierAuth,
  signIn: supplierSignIn,
  signOut: supplierSignOut,
} = NextAuth({
  // Its own endpoints, under /supplier so the path-scoped cookie reaches them.
  basePath: "/supplier/api/auth",
  session: { strategy: "jwt" },
  pages: { signIn: "/supplier/login" },
  trustHost: true,
  cookies: {
    sessionToken: { name: SUPPLIER_SESSION_COOKIE, options: cookieOptions },
    callbackUrl: { name: cookieName("callback-url"), options: cookieOptions },
    csrfToken: {
      name: SECURE ? `__Host-pc-supplier.csrf-token` : `pc-supplier.csrf-token`,
      // `__Host-` forbids a path other than "/", so the CSRF cookie is the one
      // that cannot be pinned to /supplier in production. It carries no
      // session, only a token checked against the request.
      options: SECURE ? { ...cookieOptions, path: "/" } : cookieOptions,
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-post", type: "email" },
        password: { label: "Lösenord", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const supplier = await getSupplierForSignIn(normalizeEmail(email));

        // Compare even when there is no row and even when the account has no
        // password yet, so "unknown", "not activated" and "wrong password"
        // take about the same time and say the same thing.
        const hash = supplier?.hashedPassword ?? PLACEHOLDER_HASH;
        const ok = await compare(password, hash);

        if (!supplier || !supplier.hashedPassword || !supplier.active || !ok) return null;
        return { id: supplier.id, email: supplier.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      // The brand and the account's state are read per request in
      // src/lib/supplier-session.ts, not carried in the token: deactivating a
      // supplier has to take effect on the next click, not on the next hour.
      if (token.sub) session.user = { ...session.user, id: token.sub };
      return session;
    },
  },
});

/** A real bcrypt hash of a value nobody can sign in with, for timing parity. */
const PLACEHOLDER_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.ZQ7VN0Q9WxLZ0aBcDeFgHiJkLmNO";
