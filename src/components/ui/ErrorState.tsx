/**
 * "Something failed." Never styled like an empty list, and never silent.
 *
 * `detail` is for a short, already-safe message. Never pass a raw exception:
 * stack traces and query text are not for the shop floor.
 */
export default function ErrorState({
  title = "Det gick inte att hämta informationen",
  detail,
  action,
}: {
  title?: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-warning bg-raised px-5 py-6 text-center"
    >
      <p className="font-medium text-warning">{title}</p>
      <p className="mt-1 text-sm text-warning">
        {detail ?? "Försök igen om en stund. Det är appen som strular, inte du."}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
