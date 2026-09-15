"use client";

const MAX_QUANTITY = 999;

/**
 * Minus / number / plus. Targets are 44px so they stay usable with a thumb on
 * the shop floor; the value is blank at zero so a long list reads as "nothing
 * ordered yet".
 */
export default function QuantityInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const active = value > 0;

  function clamp(next: number): number {
    if (!Number.isFinite(next)) return 0;
    return Math.min(MAX_QUANTITY, Math.max(0, Math.trunc(next)));
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Minska ${label}`}
        onClick={() => onChange(clamp(value - 1))}
        disabled={value === 0}
        className="h-11 w-11 shrink-0 rounded-xl border border-zinc-200 bg-white text-xl leading-none text-zinc-600 transition active:scale-95 disabled:opacity-30"
      >
        −
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_QUANTITY}
        step={1}
        aria-label={label}
        placeholder="0"
        value={active ? String(value) : ""}
        onChange={(event) => onChange(clamp(Number.parseInt(event.target.value, 10)))}
        onFocus={(event) => event.currentTarget.select()}
        className={`h-11 w-16 rounded-xl border text-center text-base font-medium tabular-nums outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
          active
            ? "border-brand-500 bg-brand-50 text-zinc-900"
            : "border-zinc-200 bg-white text-zinc-400 placeholder:text-zinc-300"
        }`}
      />

      <button
        type="button"
        aria-label={`Öka ${label}`}
        onClick={() => onChange(clamp(value + 1))}
        className="h-11 w-11 shrink-0 rounded-xl border border-zinc-200 bg-white text-xl leading-none text-zinc-600 transition active:scale-95"
      >
        +
      </button>
    </div>
  );
}
