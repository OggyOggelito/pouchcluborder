import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getUserById, getUserForSignIn } from "@/lib/repositories/users";
import { toRole } from "@/lib/roles";

/**
 * Auth.js with a credentials provider.
 *
 * Session strategy is JWT because Auth.js does not support database sessions
 * with the credentials provider. The token therefore carries only the user id;
 * role and store access are read from the database on each request (see
 * src/lib/session.ts), so revoking a store takes effect immediately instead of
 * waiting for the token to expire.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
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

        const user = await getUserForSignIn(email);
        // Compare even when the user is unknown, so a missing account and a
        // wrong password take about the same time to answer.
        const hash = user?.hashedPassword ?? PLACEHOLDER_HASH;
        const ok = await compare(password, hash);

        if (!user || !ok) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (!token.sub) return session;
      const user = await getUserById(token.sub);
      if (!user) return session;

      session.user = {
        ...session.user,
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        role: toRole(user.role),
      };
      return session;
    },
  },
});

/** A real bcrypt hash of a value nobody can sign in with, for timing parity. */
const PLACEHOLDER_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.ZQ7VN0Q9WxLZ0aBcDeFgHiJkLmNO";
