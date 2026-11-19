import "server-only";
import { cookies } from "next/headers";

/**
 * Which door this browser last came in through.
 *
 * The supplier session cookie is pinned to `/supplier`, which is what keeps a
 * supplier session out of the staff app — but it also means the entry page at
 * `/` cannot see it. This cookie exists so a signed-in supplier opening `/`
 * lands on their portal instead of being asked to choose again.
 *
 * It holds the literal string "supplier" and nothing else: no id, no email, no
 * brand. It is never read by either login form and never shown, so it cannot
 * tell one door anything about an account on the other. A staff session always
 * wins over it, so sharing a browser does not misroute anybody.
 */
const NAME = "pc-portal";

export async function rememberSupplierDoor(): Promise<void> {
  const jar = await cookies();
  jar.set(NAME, "supplier", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function forgetDoor(): Promise<void> {
  const jar = await cookies();
  jar.delete(NAME);
}

export async function lastDoorWasSupplier(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(NAME)?.value === "supplier";
}
