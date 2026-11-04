/**
 * One pill, one vocabulary of tones, used by transfers, problem reports,
 * customer requests and shift notes — which each had their own colour map.
 */
export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  info: "bg-blue-100 text-blue-900",
  warning: "bg-amber-100 text-amber-900",
  success: "bg-brand-50 text-brand-700",
  danger: "bg-red-100 text-red-900",
};

export default function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
