/**
 * Loading placeholder, shaped like the thing that is coming.
 *
 * `aria-hidden` with a live-region label beside it, so a screen reader hears
 * "Laddar" once instead of reading a dozen empty boxes.
 */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-raised ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div aria-hidden className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="mt-3 h-3 w-full" />
      <SkeletonLine className="mt-2 h-3 w-2/3" />
    </div>
  );
}

export default function SkeletonList({ rows = 3, label = "Laddar" }: { rows?: number; label?: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  );
}
