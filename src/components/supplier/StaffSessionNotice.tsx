import { logoutAction } from "@/lib/auth-actions";

/**
 * "You are signed in as staff."
 *
 * Shown instead of the supplier portal when a staff session is present. Two
 * sentences and a button: no brand, no booking, no figure, nothing that would
 * be a leak if the person reading it were not who the session says.
 */
export default function StaffSessionNotice() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Du är inloggad som personal</h1>
      <p className="mt-3 text-muted">
        Leverantörsportalen är en egen inloggning. Logga ut först, så kan du logga in som
        leverantör.
      </p>

      <form action={logoutAction} className="mt-8">
        <button
          type="submit"
          className="min-h-14 w-full rounded-2xl bg-primary px-6 font-semibold text-on-primary transition active:scale-[0.99]"
        >
          Logga ut
        </button>
      </form>
    </main>
  );
}
