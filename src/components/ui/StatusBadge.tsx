/**
 * One pill, one vocabulary of tones, used by transfers, problem reports,
 * customer requests and shift notes — which each had their own colour map.
 *
 * Every tone carries a glyph as well as a colour. On this theme the body text
 * is already the brand yellow, so a tinted pill on its own is a weak signal —
 * and for anyone who cannot separate the hues it is no signal at all. The
 * shape says it too.
 *
 * `success` is deliberately green rather than the brand yellow: yellow means
 * "press me" everywhere else in the app.
 */
export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger";

const TONES: Record<BadgeTone, { className: string; glyph: string; label: string }> = {
  neutral: { className: "border-control text-ink", glyph: "•", label: "" },
  info: { className: "border-info text-info", glyph: "i", label: "Information:" },
  warning: { className: "border-warning text-warning", glyph: "!", label: "Varning:" },
  success: { className: "border-success text-success", glyph: "✓", label: "Klart:" },
  danger: { className: "border-danger text-danger", glyph: "✕", label: "Fel:" },
};

export default function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  const { className, glyph, label } = TONES[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-raised px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {/* Said in text for a screen reader, drawn for everyone else. */}
      {label ? <span className="sr-only">{label}</span> : null}
      <span aria-hidden className="text-[0.9em] leading-none">
        {glyph}
      </span>
      {children}
    </span>
  );
}
