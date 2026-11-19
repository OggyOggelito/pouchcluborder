import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteTemplateItemAction,
  reorderTemplateItemAction,
  saveTemplateAction,
  saveTemplateItemAction,
} from "@/lib/checklist-actions";
import { CHECKLIST_TYPES, CHECKLIST_TYPE_LABELS, toChecklistType } from "@/lib/checklists";
import { getTemplate } from "@/lib/repositories/checklists";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const FIELD =
  "mt-1 w-full bg-raised rounded-xl border border-control px-3 py-2 text-[15px] text-ink placeholder:text-muted outline-none transition focus:border-primary";

export default async function EditChecklistTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <Link
        href="/admin/checklists"
        className="inline-flex h-9 items-center text-sm text-muted underline underline-offset-4"
      >
        ← Alla mallar
      </Link>

      <form action={saveTemplateAction} className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <input type="hidden" name="id" value={template.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-ink">Titel</label>
            <input id="title" name="title" defaultValue={template.title} className={FIELD} />
          </div>
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-ink">Typ</label>
            <select id="type" name="type" defaultValue={toChecklistType(template.type)} className={FIELD}>
              {CHECKLIST_TYPES.map((type) => (
                <option key={type} value={type}>{CHECKLIST_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="intro" className="block text-sm font-medium text-ink">
            Ingress (markdown, valfri)
          </label>
          <textarea id="intro" name="intro" rows={3} defaultValue={template.intro ?? ""} className={FIELD} />
        </div>
        <label className="mt-3 flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={template.active} className="h-5 w-5 rounded" />
          <span className="text-sm">Aktiv</span>
        </label>
        <button type="submit" className="mt-4 h-11 w-full rounded-xl bg-primary font-medium text-on-primary">
          Spara mall
        </button>
      </form>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">
        Punkter ({template.items.length})
      </h2>
      <p className="mt-1 text-sm text-muted">
        Ändringar här påverkar bara nya körningar. Redan påbörjade listor behåller sina punkter.
      </p>

      <ul className="mt-3 space-y-3">
        {template.items.map((item, index) => (
          <li key={item.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <form action={saveTemplateItemAction} className="space-y-3">
              <input type="hidden" name="templateId" value={template.id} />
              <input type="hidden" name="itemId" value={item.id} />
              <input name="title" defaultValue={item.title} className={FIELD} aria-label="Titel" />
              <textarea
                name="description"
                rows={2}
                defaultValue={item.description ?? ""}
                placeholder="Beskrivning (markdown, valfri)"
                aria-label="Beskrivning"
                className={`${FIELD} font-mono text-sm`}
              />
              <input
                name="linkUrl"
                defaultValue={item.linkUrl ?? ""}
                placeholder="/staff/brands/zyn (intern länk, valfri)"
                aria-label="Länk"
                className={`${FIELD} font-mono text-sm`}
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="required" defaultChecked={item.required} className="h-5 w-5 rounded" />
                  <span className="text-sm">Obligatorisk</span>
                </label>
                <button type="submit" className="min-h-tap rounded-xl border border-control px-4 text-sm font-medium transition hover:bg-raised">
                  Spara
                </button>
              </div>
            </form>

            <div className="mt-2 flex gap-2">
              {[["up", "↑", index === 0], ["down", "↓", index === template.items.length - 1]].map(
                ([direction, glyph, disabled]) => (
                  <form key={direction as string} action={reorderTemplateItemAction}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="direction" value={direction as string} />
                    <button
                      type="submit"
                      disabled={disabled as boolean}
                      aria-label={direction === "up" ? "Flytta upp" : "Flytta ner"}
                      className="h-9 w-9 rounded-lg border border-line text-sm disabled:opacity-30"
                    >
                      {glyph as string}
                    </button>
                  </form>
                )
              )}
              <form action={deleteTemplateItemAction}>
                <input type="hidden" name="templateId" value={template.id} />
                <input type="hidden" name="itemId" value={item.id} />
                <button type="submit" className="h-9 rounded-lg border border-danger px-3 text-sm text-danger transition hover:bg-raised">
                  Ta bort
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-6 rounded-2xl border border-dashed border-control p-4">
        <h3 className="font-medium">Lägg till punkt</h3>
        <form action={saveTemplateItemAction} className="mt-3 space-y-3">
          <input type="hidden" name="templateId" value={template.id} />
          <input name="title" required placeholder="Titel" aria-label="Titel" className={FIELD} />
          <textarea name="description" rows={2} placeholder="Beskrivning (markdown, valfri)" aria-label="Beskrivning" className={`${FIELD} font-mono text-sm`} />
          <input name="linkUrl" placeholder="/staff/... (valfri)" aria-label="Länk" className={`${FIELD} font-mono text-sm`} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="required" defaultChecked className="h-5 w-5 rounded" />
            <span className="text-sm">Obligatorisk</span>
          </label>
          <button type="submit" className="h-11 w-full rounded-xl bg-primary font-medium text-on-primary">
            Lägg till
          </button>
        </form>
      </section>
    </main>
  );
}
