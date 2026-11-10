import Link from "next/link";

/**
 * The one surface. Everything that was a hand-rolled
 * `rounded-2xl border border-line bg-surface p-N shadow-sm` is this.
 *
 * With `href` it becomes a link card with a 44px floor and a press state;
 * without, a plain container.
 */
export default function Card({
  href,
  children,
  className = "",
  padding = "p-4",
  active = false,
}: {
  href?: string;
  children: React.ReactNode;
  className?: string;
  padding?: string;
  active?: boolean;
}) {
  const base = `rounded-2xl border bg-surface shadow-sm ${padding} ${
    active ? "border-primary" : "border-line"
  } ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} block min-h-tap transition active:scale-[0.99] hover:border-control`}
      >
        {children}
      </Link>
    );
  }

  return <div className={base}>{children}</div>;
}
