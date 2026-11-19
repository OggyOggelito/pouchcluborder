"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { forgetDoor } from "@/lib/portal-cookie";
import { consume, describeRetry, reset, SIGN_IN_RULE } from "@/lib/rate-limit";

export type LoginState = { error: string | null };

/** Only ever redirect within this app — never to a URL a query string supplies. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/idag";
  // The staff login never sends anybody into the supplier portal, whatever
  // the query string asks for: the two doors do not hand off to each other.
  if (next === "/supplier" || next.startsWith("/supplier/")) return "/idag";
  return next;
}

async function clientKey(email: string): Promise<string> {
  const headerList = await headers();
  const ip = (headerList.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  return `staff|${ip}|${email.trim().toLowerCase()}`;
}

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const next = safeNext(formData.get("next"));
  const email = String(formData.get("email") ?? "");

  const key = await clientKey(email);
  const limit = consume(key, SIGN_IN_RULE);
  if (!limit.allowed) {
    return { error: `För många försök. Försök igen ${describeRetry(limit.retryAfterMs)}.` };
  }

  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // The same sentence for an unknown address, a wrong password and a
      // supplier email typed into the staff form. The supplier table is not
      // even consulted here, so this form cannot be used to find out whether
      // a supplier account exists.
      return { error: "Fel e-post eller lösenord." };
    }
    throw error;
  }

  reset(key);
  // Signing in as staff clears the "last door" hint, so a shared browser does
  // not bounce a staff user into the supplier portal from `/`.
  await forgetDoor();

  redirect(next);
}

export async function logoutAction() {
  await forgetDoor();
  await signOut({ redirectTo: "/login" });
}
