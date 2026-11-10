import { prisma } from "@/lib/db";

/**
 * Employees.
 *
 * What is stored about a person: a name, a home store, whether they still work
 * here, whether they have agreed to be offered extra shifts elsewhere, and an
 * optional link to a portal account. That is the whole record.
 *
 * Nothing else belongs here — no personnummer, no payroll, no phone or email,
 * no absence reasons, no notes about the person. Those are the fields a staff
 * list grows by accident, so the shape is fixed here and the forms have no box
 * to type them into.
 */
export type EmployeeView = {
  id: string;
  name: string;
  active: boolean;
  openToExtraShifts: boolean;
  homeStore: { id: string; name: string };
  /**
   * The linked portal account, if any. Without one the person cannot see
   * their own shifts — `ScheduleProvider` is keyed by user, not by employee.
   */
  account: { id: string; label: string } | null;
};

const EMPLOYEE_SELECT = {
  id: true,
  name: true,
  active: true,
  openToExtraShifts: true,
  homeStore: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, email: true } },
} as const;

type RawEmployee = {
  id: string;
  name: string;
  active: boolean;
  openToExtraShifts: boolean;
  homeStore: { id: string; name: string };
  user: { id: string; name: string | null; email: string } | null;
};

function toView(row: RawEmployee): EmployeeView {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    openToExtraShifts: row.openToExtraShifts,
    homeStore: row.homeStore,
    account: row.user ? { id: row.user.id, label: row.user.name ?? row.user.email } : null,
  };
}

export async function listEmployees(input: {
  storeIds: string[];
  includeInactive?: boolean;
}): Promise<EmployeeView[]> {
  if (input.storeIds.length === 0) return [];

  const rows = await prisma.employee.findMany({
    where: {
      homeStoreId: { in: input.storeIds },
      ...(input.includeInactive ? {} : { active: true }),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: EMPLOYEE_SELECT,
  });
  return rows.map(toView);
}

export async function getEmployee(id: string): Promise<EmployeeView | null> {
  const row = await prisma.employee.findUnique({ where: { id }, select: EMPLOYEE_SELECT });
  return row ? toView(row) : null;
}

/** The employee a signed-in account belongs to, if any. */
export async function employeeForUser(userId: string): Promise<EmployeeView | null> {
  const row = await prisma.employee.findUnique({
    where: { userId },
    select: EMPLOYEE_SELECT,
  });
  return row ? toView(row) : null;
}

export async function createEmployee(input: {
  name: string;
  homeStoreId: string;
  userId?: string | null;
  openToExtraShifts?: boolean;
}): Promise<string> {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("An employee needs a name.");

  const employee = await prisma.employee.create({
    data: {
      name,
      homeStoreId: input.homeStoreId,
      userId: input.userId || null,
      openToExtraShifts: input.openToExtraShifts ?? false,
    },
    select: { id: true },
  });
  return employee.id;
}

/**
 * Edits one employee.
 *
 * Moving someone's home store does not move their existing shifts: those
 * record where the work happened, and rewriting history to match a transfer
 * would make last month's grid wrong.
 */
export async function updateEmployee(
  id: string,
  input: {
    name?: string;
    homeStoreId?: string;
    active?: boolean;
    openToExtraShifts?: boolean;
    userId?: string | null;
  }
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length === 0) throw new Error("An employee needs a name.");
    data.name = name;
  }
  if (input.homeStoreId !== undefined) data.homeStoreId = input.homeStoreId;
  if (input.active !== undefined) data.active = input.active;
  if (input.openToExtraShifts !== undefined) data.openToExtraShifts = input.openToExtraShifts;
  if (input.userId !== undefined) data.userId = input.userId || null;

  if (Object.keys(data).length === 0) return;
  await prisma.employee.update({ where: { id }, data });
}

/** Deactivation is the only way out. History stays intact. */
export async function deactivateEmployee(id: string): Promise<void> {
  await prisma.employee.update({ where: { id }, data: { active: false } });
}

export async function countEmployees(
  storeIds: string[]
): Promise<{ active: number; inactive: number; openToExtra: number }> {
  if (storeIds.length === 0) return { active: 0, inactive: 0, openToExtra: 0 };

  const [active, inactive, openToExtra] = await Promise.all([
    prisma.employee.count({ where: { homeStoreId: { in: storeIds }, active: true } }),
    prisma.employee.count({ where: { homeStoreId: { in: storeIds }, active: false } }),
    prisma.employee.count({
      where: { homeStoreId: { in: storeIds }, active: true, openToExtraShifts: true },
    }),
  ]);
  return { active, inactive, openToExtra };
}

/**
 * Accounts that could be linked to an employee: a store's own users who are
 * not already somebody's record.
 */
export async function linkableUsers(
  storeIds: string[]
): Promise<{ id: string; label: string }[]> {
  if (storeIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      employee: null,
      storeAccess: { some: { storeId: { in: storeIds } } },
    },
    orderBy: { email: "asc" },
    select: { id: true, name: true, email: true },
  });
  return users.map((user) => ({ id: user.id, label: user.name ?? user.email }));
}
