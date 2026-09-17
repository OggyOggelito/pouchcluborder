import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/");

  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Logga in</h1>
      <p className="mt-1 text-zinc-600">För att lägga en beställning.</p>

      <LoginForm next={safeNext} />

      <p className="mt-6 text-sm text-zinc-500">
        Inget konto? Konton skapas av administratören — hör av dig till kontoret.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/staff" className="text-zinc-600 underline underline-offset-4">
          Till varumärkesguiden
        </Link>{" "}
        <span className="text-zinc-400">(kräver ingen inloggning)</span>
      </p>
    </main>
  );
}
