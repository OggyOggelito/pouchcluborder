import Link from "next/link";
import { redirect } from "next/navigation";
import SupplierLoginForm from "@/components/supplier/SupplierLoginForm";
import { getSupplierUser } from "@/lib/supplier-session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Logga in som leverantör — Pouch Club" };

/**
 * The supplier login.
 *
 * Says nothing about whether an account exists: no "kontot är inte aktiverat",
 * no "okänd adress", no list of brands. An account is created by an
 * administrator and arrives as a link; there is nothing to sign up for here,
 * so there is no sign-up link either.
 */
export default async function SupplierLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ klart?: string }>;
}) {
  const supplier = await getSupplierUser();
  if (supplier) redirect("/supplier");

  const { klart } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Logga in som leverantör</h1>
      <p className="mt-1 text-muted">För statistik och demodagar.</p>

      {klart ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-success bg-raised p-3 text-sm text-success"
        >
          <span aria-hidden>✓ </span>Lösenordet är sparat. Logga in med det.
        </p>
      ) : null}

      <SupplierLoginForm />

      <p className="mt-6 text-sm text-muted">
        Konton skapas av Pouch Club. Har du tappat lösenordet, eller inte fått någon länk? Hör av
        dig till din kontakt hos oss, så skickas en ny.
      </p>

      <p className="mt-6 text-sm">
        <Link href="/" className="text-muted underline underline-offset-4">
          Byt inloggning
        </Link>
      </p>
    </main>
  );
}
