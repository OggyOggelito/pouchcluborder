import Link from "next/link";
import SupplierPasswordForm from "@/components/supplier/SupplierPasswordForm";
import { lookupToken } from "@/lib/repositories/supplier-users";

export const dynamic = "force-dynamic";

export const metadata = { title: "Välj lösenord — Pouch Club" };

/**
 * Activating an invite, or using a reset link.
 *
 * An unknown token, an expired one and a deactivated account all get the same
 * sentence, so the page cannot be used to find out whether a link ever
 * existed. The email is shown only once the token is known to be good — at
 * which point whoever holds the link already has it.
 */
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const lookup = token ? await lookupToken(token) : ({ ok: false, reason: "unknown" } as const);

  if (!lookup.ok) {
    return (
      <main className="mx-auto max-w-sm px-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Länken gäller inte längre</h1>
        <p className="mt-2 text-muted">
          Länkar är giltiga en kort tid och kan bara användas en gång. Be din kontakt hos Pouch
          Club om en ny.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/supplier/login" className="underline underline-offset-4">
            Till inloggningen
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {lookup.kind === "RESET" ? "Välj ett nytt lösenord" : "Välj ett lösenord"}
      </h1>
      <p className="mt-1 text-muted">
        {lookup.email} · {lookup.brandName}
      </p>

      <SupplierPasswordForm token={token ?? ""} />
    </main>
  );
}
