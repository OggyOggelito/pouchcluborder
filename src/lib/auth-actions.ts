"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export type LoginState = { error: string | null };

/** Only ever redirect within this app — never to a URL a query string supplies. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const next = safeNext(formData.get("next"));

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Fel e-post eller lösenord." };
    }
    throw error;
  }

  redirect(next);
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
