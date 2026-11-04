/**
 * "There is genuinely nothing here."
 *
 * Distinct from ErrorState on purpose: the audit found pages that render
 * "Inget här just nu." whether the list was empty or the query had failed,
 * which is at its worst on a schedule — an empty week and a broken week look
 * the same and only one of them means you are off work.
 */
export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center">
      <p className="font-medium text-zinc-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
