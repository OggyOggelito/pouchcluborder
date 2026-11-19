import SupplierPasswordForm from "@/components/supplier/SupplierPasswordForm";
import { getSupplierUser } from "@/lib/supplier-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Byt lösenord — Pouch Club" };

/**
 * Changing your own password.
 *
 * Also where an account with a temporary password is sent, and the only page
 * it can reach until the password has been changed — `requireSupplier` sends
 * it back here otherwise.
 */
export default async function ChangePasswordPage() {
  const supplier = await getSupplierUser();
  if (!supplier) redirect("/supplier/login");

  return (
    <main className="px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Byt lösenord</h1>
      {supplier.mustChangePassword ? (
        <p className="mt-2 text-muted">
          Kontot har ett tillfälligt lösenord. Välj ett eget för att komma vidare.
        </p>
      ) : (
        <p className="mt-2 text-muted">{supplier.email}</p>
      )}

      <SupplierPasswordForm />
    </main>
  );
}
