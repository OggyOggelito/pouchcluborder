import Link from "next/link";

/**
 * The top of every page: where you are, what the page is for, and at most one
 * primary action.
 *
 * `action` is deliberately a single slot. The audit found screens with three
 * equally-weighted buttons and nothing to say which one the page was for.
 */
export default function PageHeader({
  title,
  description,
  action,
  breadcrumb,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** One level up. Admin pages always pass the hub. */
  breadcrumb?: { href: string; label: string };
}) {
  return (
    <div className="mb-5">
      {breadcrumb ? (
        <nav aria-label="Brödsmula" className="mb-2">
          <Link
            href={breadcrumb.href}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl pr-2 text-sm text-zinc-600 transition hover:text-zinc-900"
          >
            <span aria-hidden>‹</span>
            {breadcrumb.label}
          </Link>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-zinc-600">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
