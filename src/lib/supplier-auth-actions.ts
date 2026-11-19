"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supplierSignIn, supplierSignOut } from "@/supplier-auth";
import { forgetDoor, rememberSupplierDoor } from "@/lib/portal-cookie";
import { consume, describeRetry, reset, SIGN_IN_RULE } from "@/lib/rate-limit";
import {
  getSupplierForSignIn,
  normalizeEmail,
  recordLogin,
  setPassword,
  setPasswordWithToken,
} from "@/lib/repositories/supplier-users";
import { getSupplierUser } from "@/lib/supplier-session";
import { validatePassword } from "@/lib/passwords";

/**
 * Signing in and out of the supplier portal.
 *
 * Separate from src/lib/auth-actions.ts in every respect: a different Auth.js
 * instance, a different cookie, a different table. Nothing in this file can
 * create a staff session and nothing in that one can create a supplier one.
 */
export type SupplierLoginState = { error: string | null };

/** One generic answer, whatever went wrong. */
const WRONG = "Fel e-post eller lösenord.";

async function clientKey(email: string): Promise<string> {
  const headerList = await headers();
  // Behind a proxy this is the client; without one it is empty and every
  // attempt shares a bucket, which is the safe direction for a limiter.
  const ip = (headerList.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  return `supplier|${ip}|${normalizeEmail(email)}`;
}

export async function supplierLoginAction(
  _state: SupplierLoginState,
  formData: FormData
): Promise<SupplierLoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const key = await clientKey(email);
  const limit = consume(key, SIGN_IN_RULE);
  if (!limit.allowed) {
    return {
      error: `För många försök. Försök igen ${describeRetry(limit.retryAfterMs)}.`,
    };
  }

  try {
    await supplierSignIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: WRONG };
    throw error;
  }

  reset(key);

  const supplier = await getSupplierForSignIn(email);
  if (supplier) await recordLogin(supplier.id);

  await rememberSupplierDoor();

  // A temporary password gets one destination until it has been changed.
  redirect(supplier?.mustChangePassword ? "/supplier/byt-losenord" : "/supplier");
}

export async function supplierLogoutAction(): Promise<void> {
  await forgetDoor();
  await supplierSignOut({ redirectTo: "/supplier/login" });
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export type SupplierPasswordState = { error: string | null };

/** Activating an invite, or using a reset link. Signed out. */
export async function activateSupplierAction(
  _state: SupplierPasswordState,
  formData: FormData
): Promise<SupplierPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (password !== repeat) return { error: "Lösenorden är inte lika." };

  const problem = validatePassword(password);
  if (problem) return { error: problem };

  const ok = await setPasswordWithToken(token, password);
  if (!ok) {
    return { error: "Länken gäller inte längre. Be administratören om en ny." };
  }

  redirect("/supplier/login?klart=1");
}

/** Changing your own password while signed in. */
export async function changeSupplierPasswordAction(
  _state: SupplierPasswordState,
  formData: FormData
): Promise<SupplierPasswordState> {
  const supplier = await getSupplierUser();
  if (!supplier) redirect("/supplier/login");

  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (password !== repeat) return { error: "Lösenorden är inte lika." };

  const problem = validatePassword(password);
  if (problem) return { error: problem };

  await setPassword(supplier.id, password);
  redirect("/supplier?losenord=1");
}
