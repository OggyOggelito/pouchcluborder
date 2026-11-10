"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createEmployee,
  deactivateEmployee,
  getEmployee,
  updateEmployee,
} from "@/lib/repositories/employees";
import { canActOnStore, canManageEmployees } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import type { UserRecord } from "@/lib/repositories/users";

/**
 * The staff list.
 *
 * An OWNER manages their own stores' employees, an ADMIN everybody's. Moving
 * somebody to a store you do not have is refused, in both directions — you
 * cannot take an employee out of a store you cannot see either.
 */
async function authorize(): Promise<UserRecord> {
  const user = await requireUser("/store/employees");
  if (!canManageEmployees(user.role)) throw new Error("Din roll kan inte hantera anställda.");
  return user;
}

function assertStore(user: UserRecord, storeId: string): void {
  if (!canActOnStore(user.role, user.stores.map((store) => store.id), storeId)) {
    throw new Error("Du har inte tillgång till den butiken.");
  }
}

export async function createEmployeeAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const homeStoreId = String(formData.get("homeStoreId") ?? "");
  assertStore(user, homeStoreId);

  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) redirect("/store/employees?fel=namn");

  await createEmployee({
    name,
    homeStoreId,
    userId: String(formData.get("userId") ?? "") || null,
    openToExtraShifts: formData.get("openToExtraShifts") === "on",
  });

  revalidatePath("/store/employees");
  redirect("/store/employees?sparat=1");
}

export async function updateEmployeeAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const id = String(formData.get("id") ?? "");

  const employee = await getEmployee(id);
  if (!employee) throw new Error("Okänd medarbetare.");
  assertStore(user, employee.homeStore.id);

  const homeStoreId = String(formData.get("homeStoreId") ?? "") || employee.homeStore.id;
  assertStore(user, homeStoreId);

  await updateEmployee(id, {
    name: String(formData.get("name") ?? employee.name),
    homeStoreId,
    openToExtraShifts: formData.get("openToExtraShifts") === "on",
    // An empty select means "no account", which is a real choice here.
    userId: formData.has("userId") ? String(formData.get("userId") ?? "") || null : undefined,
  });

  revalidatePath("/store/employees");
  redirect("/store/employees?sparat=1");
}

/** Deactivation, never deletion — last month's grid must still say who worked. */
export async function deactivateEmployeeAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const id = String(formData.get("id") ?? "");

  const employee = await getEmployee(id);
  if (!employee) return;
  assertStore(user, employee.homeStore.id);

  await deactivateEmployee(id);

  revalidatePath("/store/employees");
  redirect("/store/employees?inaktiverad=1");
}

export async function reactivateEmployeeAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const id = String(formData.get("id") ?? "");

  const employee = await getEmployee(id);
  if (!employee) return;
  assertStore(user, employee.homeStore.id);

  await updateEmployee(id, { active: true });

  revalidatePath("/store/employees");
  redirect("/store/employees?sparat=1");
}
