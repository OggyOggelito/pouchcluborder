import type { ScheduleWarning } from "@/lib/schedule/week";

/**
 * Warnings, in text with a glyph.
 *
 * Never colour alone: the body text on this theme is already the brand yellow,
 * and a tinted sentence among yellow sentences is no signal at all for anyone
 * who cannot separate the hues. The icon and the word carry it.
 */
export default function WarningList({
  warnings,
  className = "",
}: {
  warnings: ScheduleWarning[];
  className?: string;
}) {
  if (warnings.length === 0) return null;

  return (
    <ul className={`space-y-1 ${className}`}>
      {warnings.map((warning, index) => (
        <li
          key={`${warning.kind}-${warning.date}-${index}`}
          className="flex items-start gap-1.5 text-xs text-warning"
        >
          <span className="sr-only">Varning:</span>
          <span aria-hidden className="leading-5">
            ⚠
          </span>
          <span>{warning.text}</span>
        </li>
      ))}
    </ul>
  );
}
