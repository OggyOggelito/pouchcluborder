import NavIcon from "@/components/nav/NavIcon";
import { logoutAction } from "@/lib/auth-actions";

/**
 * Rendered on the server and passed into the sidebar and the sheet as a prop,
 * so the server action stays on the server and both menus share one button.
 */
export default function SignOutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-zinc-700 transition hover:bg-zinc-100"
      >
        <NavIcon name="logout" className="h-5 w-5 shrink-0 text-zinc-500" />
        <span>Logga ut</span>
      </button>
    </form>
  );
}
