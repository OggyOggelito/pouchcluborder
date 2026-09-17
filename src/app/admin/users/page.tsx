import UserAdmin from "@/components/UserAdmin";
import { listStores } from "@/lib/repositories/stores";
import { listUsers } from "@/lib/repositories/users";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const [users, stores] = await Promise.all([listUsers(), listStores()]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Konton</h1>
      <p className="mt-1 text-zinc-600">
        Butiksägare ser bara sina egna butiker. Administratörer ser alla.
      </p>
      <UserAdmin users={users} stores={stores} />
    </main>
  );
}
