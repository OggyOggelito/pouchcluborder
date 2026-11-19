"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  SupplierAccountError,
  createSupplierUser,
  issueToken,
  setActive,
} from "@/lib/repositories/supplier-users";
import { canManageSuppliers } from "@/lib/roles";
import { requireUser } from "@/lib/session";

/**
 * Supplier accounts, from the admin side.
 *
 * There is no self-signup and no public reset: an account is created here and
 * arrives as a one-time link. The link is shown to the admin once, because
 * this app has no mail transport — see docs/supplier-portal.md. Storing it
 * would defeat the point of hashing the token.
 */
async function authorize() {
  const user = await requireUser("/admin/suppliers");
  if (!canManageSuppliers(user.role)) {
    throw new Error("Bara administratörer kan hantera leverantörskonton.");
  }
  return user;
}

export type SupplierAdminState = { error: string | null; link?: string | null };

export async function createSupplierAction(
  _state: SupplierAdminState,
  formData: FormData
): Promise<SupplierAdminState> {
  const user = await authorize();

  try {
    const { token } = await createSupplierUser({
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? "") || null,
      brandId: String(formData.get("brandId") ?? ""),
      invitedById: user.id,
    });

    revalidatePath("/admin/suppliers");
    return { error: null, link: `/supplier/aktivera?token=${token}` };
  } catch (error) {
    if (error instanceof SupplierAccountError) return { error: error.message };
    return { error: "Kontot kunde inte skapas." };
  }
}

export async function reissueLinkAction(
  _state: SupplierAdminState,
  formData: FormData
): Promise<SupplierAdminState> {
  await authorize();

  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "RESET") === "INVITE" ? "INVITE" : "RESET";

  const { token } = await issueToken(id, kind);
  revalidatePath("/admin/suppliers");
  return { error: null, link: `/supplier/aktivera?token=${token}` };
}

export async function setSupplierActiveAction(formData: FormData): Promise<void> {
  await authorize();

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "1";

  await setActive(id, active);
  revalidatePath("/admin/suppliers");
  redirect(`/admin/suppliers?${active ? "aktiverad" : "inaktiverad"}=1`);
}

/**
 * Granting a staff account the statistics permission.
 *
 * Deliberately on the supplier-accounts page rather than on the user list:
 * this is about who may read a supplier's commercial figures, which is the
 * same conversation.
 */
export async function setStatsPermissionAction(formData: FormData): Promise<void> {
  await authorize();

  const userId = String(formData.get("userId") ?? "");
  const canViewStats = String(formData.get("canViewStats") ?? "") === "1";

  // Only an ADMIN can hold it: granting it to an account that is not one
  // would be a permission nothing reads, waiting to become a surprise.
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || target.role !== "ADMIN") {
    redirect("/admin/suppliers?fel=roll");
  }

  await prisma.user.update({ where: { id: userId }, data: { canViewStats } });
  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers?sparat=1");
}
