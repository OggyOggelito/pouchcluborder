import Link from "next/link";
import {
  assignOnboardingAction,
  saveTemplateAction,
} from "@/lib/checklist-actions";
import {
  CHECKLIST_TYPES,
  CHECKLIST_TYPE_DESCRIPTIONS,
  CHECKLIST_TYPE_LABELS,
} from "@/lib/checklists";
import { listTemplates } from "@/lib/repositories/checklists";
import { listUsers } from "@/lib/repositories/users";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const FIELD =
  "mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-[15px] outline-none transition focus:border-zinc-400";

export default async function AdminChecklistsPage() {
  await requireAdmin();
  const [templates, users] = await Promise.all([listTemplates(), listUsers()]);
  const onboarding = templates.filter((template) => template.type === "ONBOARDING");

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Checklistor</h1>
      <p className="mt-1 text-zinc-600">
        {templates.length} mallar.{" "}
        <Link href="/admin/checklists/today" className="underline underline-offset-4">
          Dagens status
        </Link>
      </p>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Ny mall</h2>
        <form action={saveTemplateAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-zinc-700">
              Titel
            </label>
            <input id="title" name="title" required className={FIELD} />
          </div>
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-zinc-700">
              Typ
            </label>
            <select id="type" name="type" defaultValue="DAILY_OPEN" className={FIELD}>
              {CHECKLIST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CHECKLIST_TYPE_LABELS[type]} — {CHECKLIST_TYPE_DESCRIPTIONS[type]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked className="h-5 w-5 rounded" />
            <span className="text-sm">Aktiv</span>
          </label>
          <button
            type="submit"
            className="h-12 w-full rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99]"
          >
            Skapa mall
          </button>
        </form>
      </section>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Mallar</h2>
      <ul className="mt-3 space-y-2">
        {templates.map((template) => (
          <li key={template.id}>
            <Link
              href={`/admin/checklists/${template.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-zinc-300"
            >
              <span className="min-w-0">
                <span className="truncate font-medium">{template.title}</span>
                <span className="mt-0.5 block text-sm text-zinc-500">
                  {CHECKLIST_TYPE_LABELS[template.type]} · {template.itemCount} punkter
                  {template.active ? "" : " · inaktiv"}
                </span>
              </span>
              <span aria-hidden className="text-zinc-500">›</span>
            </Link>
          </li>
        ))}
      </ul>

      {onboarding.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">Tilldela introduktion</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Skapar personens körning. Senare ändringar i mallen påverkar inte en redan
            påbörjad introduktion.
          </p>
          <form action={assignOnboardingAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <select name="templateId" className={FIELD} aria-label="Mall">
              {onboarding.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
            <select name="userId" className={FIELD} aria-label="Person">
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? user.email}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-11 rounded-xl border border-zinc-200 px-5 text-sm font-medium transition hover:bg-zinc-50 sm:mt-1"
            >
              Tilldela
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
