import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import { TERMS } from "@/lib/terms";
import { getFeatures } from "@/lib/features";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inställningar — Pouch Club",
};

/**
 * Account, stores, and the glossary.
 *
 * Read-only for now: there is nothing here a store user may change about their
 * own account, and pretending otherwise with disabled fields would be worse
 * than saying who to ask. Push notification settings appear only once VAPID
 * keys exist — the app cannot send push today, so offering the toggle would be
 * a promise it cannot keep.
 */
export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const features = await getFeatures();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <PageHeader title="Inställningar" description="Ditt konto och hur appen är inställd." />

      <Card className="mb-3">
        <h2 className="font-semibold tracking-tight">Konto</h2>
        <dl className="mt-2 space-y-1 text-[15px]">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted">Namn</dt>
            <dd className="min-w-0">{user.name?.trim() || "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted">E-post</dt>
            <dd className="min-w-0 break-words">{user.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted">Roll</dt>
            <dd className="min-w-0">
              {ROLE_LABELS[user.role]}
              <span className="block text-sm text-muted">
                {ROLE_DESCRIPTIONS[user.role]}
              </span>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted">Butiker</dt>
            <dd className="min-w-0">
              {user.stores.length === 0
                ? "Ingen butik kopplad"
                : user.stores.map((store) => store.name).join(", ")}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted">
          Behöver något ändras — namn, lösenord eller butik — hör av dig till en administratör.
        </p>
      </Card>

      <Card className="mb-3">
        <h2 className="font-semibold tracking-tight">Ordlista</h2>
        <dl className="mt-2 space-y-2 text-[15px]">
          {Object.values(TERMS).map((term) => (
            <div key={term.one}>
              <dt className="font-medium">
                {term.one} <span className="font-normal text-muted">({term.many})</span>
              </dt>
              <dd className="text-muted">{term.explanation}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {features.push ? (
        <Card className="mb-3">
          <h2 className="font-semibold tracking-tight">Aviseringar i mobilen</h2>
          <p className="mt-1 text-sm text-muted">
            Push är konfigurerat för den här installationen.
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-semibold tracking-tight">Vad som är igång</h2>
        <p className="mt-1 text-sm text-muted">
          Delar av appen visas först när de är konfigurerade och har innehåll. Det som inte är
          igång döljs helt i menyn.
        </p>
        <ul className="mt-3 space-y-1 text-[15px]">
          {(
            [
              ["Beställning", features.ordering],
              ["Varumärkesguide", features.guide],
              ["Nyheter", features.news],
              ["Schema", features.schedule],
              ["Checklistor", features.checklists],
              ["Quiz", features.quizzes],
              ["Rutiner", features.routines],
              ["Push till mobilen", features.push],
            ] as const
          ).map(([label, on]) => (
            <li key={label} className="flex items-center justify-between gap-3">
              <span>{label}</span>
              <span className={on ? "text-primary" : "text-muted"}>
                {on ? "Igång" : "Inte igång"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
