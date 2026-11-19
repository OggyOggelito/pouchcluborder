import type { Bucket } from "@/lib/sales/aggregate";

/**
 * The trend, as bars.
 *
 * Inline SVG rather than a charting library: one chart does not justify a
 * dependency, and a library would arrive with its own colours to fight the
 * theme. Colour comes from `fill-primary`, which is a theme token, so the
 * colour lint stays green.
 *
 * The figures are also in the table below, so the chart carries no information
 * of its own — which is what makes it safe for anyone who cannot see it.
 */
export default function TrendChart({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) return null;

  const max = Math.max(...buckets.map((bucket) => bucket.quantity), 1);
  const width = 100;
  const height = 40;
  const gap = buckets.length > 40 ? 0.2 : 1;
  const barWidth = Math.max((width - gap * (buckets.length - 1)) / buckets.length, 0.4);

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Trend: ${buckets.length} perioder, högsta värdet ${max} sålda.`}
        className="h-32 w-full text-primary"
      >
        {buckets.map((bucket, index) => {
          const barHeight = (bucket.quantity / max) * height;
          return (
            <rect
              key={bucket.key}
              x={index * (barWidth + gap)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              className="fill-current"
            />
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}
