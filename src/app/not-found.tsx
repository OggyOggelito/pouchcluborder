import Link from "next/link";

/**
 * 404, in Swedish and with a way out.
 *
 * The app uses `notFound()` as its "you may not see this" answer — an OWNER
 * opening an admin URL lands here — so the copy has to work for both "gone"
 * and "not yours" without implying either.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Sidan finns inte</h1>
      <p className="mt-2 text-ink">
        Länken kan vara gammal, eller så är sidan inte till för ditt konto.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-tap items-center rounded-2xl bg-primary px-5 font-semibold text-on-primary"
      >
        Till startsidan
      </Link>
    </main>
  );
}
