"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { getBrandById, updateBrandContent } from "@/lib/repositories/brands";
import { createUser, setPassword, setStoreAccess } from "@/lib/repositories/users";
import { prisma } from "@/lib/db";
import { toRole } from "@/lib/roles";
import { requireAdmin } from "@/lib/session";

const BCRYPT_ROUNDS = 12;

function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

export type BrandFormState = { error: string | null; savedAt: number | null };

export async function saveBrandAction(
  _state: BrandFormState,
  formData: FormData
): Promise<BrandFormState> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Okänt varumärke.", savedAt: null };

  const brand = await getBrandById(id);
  if (!brand) return { error: "Varumärket finns inte.", savedAt: null };

  await updateBrandContent(id, {
    manufacturerCode: text(formData, "manufacturerCode"),
    countryOfOrigin: text(formData, "countryOfOrigin"),
    shortDescription: text(formData, "shortDescription"),
    manufacturingProcess: text(formData, "manufacturingProcess"),
    blendingNotes: text(formData, "blendingNotes"),
    logoUrl: text(formData, "logoUrl"),
    heroImageUrl: text(formData, "heroImageUrl"),
    websiteUrl: text(formData, "websiteUrl"),
    published: formData.get("published") === "on",
  });

  revalidatePath("/staff");
  revalidatePath(`/staff/brands/${brand.slug}`);
  revalidatePath("/admin/brands");

  return { error: null, savedAt: Date.now() };
}

export type UserFormState = { error: string | null; message: string | null };

export async function createUserAction(
  _state: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();

  const email = text(formData, "email")?.toLowerCase();
  const password = formData.get("password");
  const storeIds = formData.getAll("storeIds").filter((v): v is string => typeof v === "string");

  if (!email) return { error: "E-post krävs.", message: null };
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Lösenordet måste vara minst 8 tecken.", message: null };
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "Det finns redan ett konto med den e-posten.", message: null };

  const role = toRole(formData.get("role"));
  if (role === "OWNER" && storeIds.length === 0) {
    return { error: "En butiksägare behöver minst en butik.", message: null };
  }

  await createUser({
    email,
    hashedPassword: await hash(password, BCRYPT_ROUNDS),
    name: text(formData, "name"),
    role,
    storeIds,
  });

  revalidatePath("/admin/users");
  return { error: null, message: `Kontot ${email} skapades.` };
}

export async function setPasswordAction(
  _state: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();

  const userId = formData.get("userId");
  const password = formData.get("password");

  if (typeof userId !== "string" || !userId) return { error: "Okänt konto.", message: null };
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Lösenordet måste vara minst 8 tecken.", message: null };
  }

  await setPassword(userId, await hash(password, BCRYPT_ROUNDS));
  revalidatePath("/admin/users");
  return { error: null, message: "Lösenordet uppdaterades." };
}

export async function setStoreAccessAction(formData: FormData) {
  await requireAdmin();

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) return;

  const storeIds = formData.getAll("storeIds").filter((v): v is string => typeof v === "string");
  await setStoreAccess(userId, storeIds);

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
