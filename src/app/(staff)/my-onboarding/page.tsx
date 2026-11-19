import ChecklistRunView from "@/components/ChecklistRunView";
import { getRun, listOnboardingRunsForUser } from "@/lib/repositories/checklists";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The person's own onboarding, assigned by an admin. */
export default async function MyOnboardingPage() {
  const user = await requireUser("/my-onboarding");
  const summaries = await listOnboardingRunsForUser(user.id);
  const runs = await Promise.all(summaries.map((summary) => getRun(summary.id)));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Min introduktion</h1>

      {summaries.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-control p-6 text-center text-muted">
          Du har ingen introduktion tilldelad. En administratör lägger upp den.
        </p>
      ) : (
        <>
          <p className="mt-1 text-muted">
            {summaries.reduce((sum, run) => sum + run.progress.done, 0)} av{" "}
            {summaries.reduce((sum, run) => sum + run.progress.total, 0)} punkter klara.
          </p>
          <div className="mt-6 space-y-10">
            {runs.map((run) => (run ? <ChecklistRunView key={run.id} run={run} /> : null))}
          </div>
        </>
      )}
    </main>
  );
}
