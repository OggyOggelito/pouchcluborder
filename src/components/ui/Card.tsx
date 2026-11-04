import Link from "next/link";

/**
 * The one surface. Everything that was a hand-rolled
 * `rounded-2xl border border-zinc-200 bg-white p-N shadow-sm` is this.
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
  const base = `rounded-2xl border bg-white shadow-sm ${padding} ${
    active ? "border-zinc-900" : "border-zinc-200"
  } ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} block min-h-tap transition active:scale-[0.99] hover:border-zinc-300`}
      >
        {children}
      </Link>
    );
  }

  return <div className={base}>{children}</div>;
}
