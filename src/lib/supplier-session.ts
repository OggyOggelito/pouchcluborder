import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { supplierAuth } from "@/supplier-auth";
import { getSupplierById } from "@/lib/repositories/supplier-users";

/**
 * Who is asking, on the supplier side.
 *
 * The mirror of src/lib/session.ts, and deliberately not an extension of it:
 * nothing here can return a staff user, and nothing there can return a
 * supplier. Both read through to the database on every request rather than
 * trusting the token, so deactivating an account takes effect on the next
 * click.
 */
export type SupplierRecord = {
  id: string;
  email: string;
  name: string | null;
  mustChangePassword: boolean;
  bookingsSeenAt: Date | null;
  brand: { id: string; name: string; slug: string };
};

export const getSupplierUser = cache(async (): Promise<SupplierRecord | null> => {
  const session = await supplierAuth();
  const id = session?.user?.id;
  if (!id) return null;

  const supplier = await getSupplierById(id);
  if (!supplier) return null;

  return {
    id: supplier.id,
    email: supplier.email,
    name: supplier.name,
    mustChangePassword: supplier.mustChangePassword,
    bookingsSeenAt: supplier.bookingsSeenAt,
    brand: supplier.brand,
  };
});

/** Signed out goes to the supplier login, never to the staff one. */
export async function requireSupplier(next?: string): Promise<SupplierRecord> {
  const supplier = await getSupplierUser();
  if (!supplier) {
    redirect(next ? `/supplier/login?next=${encodeURIComponent(next)}` : "/supplier/login");
  }
  // An account with a temporary password gets exactly one destination until
  // it has been changed.
  if (supplier.mustChangePassword) redirect("/supplier/byt-losenord");
  return supplier;
}

/**
 * The guard every supplier query goes through.
 *
 * A supplier's authorization is one brand id. Anything scoped by brand asks
 * this rather than comparing ids inline, so there is one place to read when
 * the question is "could a supplier see another brand's data".
 */
export function assertOwnBrand(supplier: SupplierRecord, brandId: string): void {
  if (supplier.brand.id !== brandId) {
    // notFound rather than a 403 page naming the brand: a supplier should not
    // be able to use error messages to learn which brand ids exist.
    notFound();
  }
}

export function ownsBrand(supplier: SupplierRecord, brandId: string): boolean {
  return supplier.brand.id === brandId;
}
