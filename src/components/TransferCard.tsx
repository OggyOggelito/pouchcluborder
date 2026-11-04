import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { TRANSFER_STATUS_LABELS, TRANSFER_UNIT_LABELS } from "@/lib/transfers";
import type { TransferView } from "@/lib/repositories/transfers";

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-800",
  ACCEPTED: "bg-brand-50 text-brand-700",
  SENT: "bg-blue-50 text-blue-800",
  RECEIVED: "bg-zinc-100 text-zinc-600",
  DECLINED: "bg-red-50 text-red-700",
  CANCELLED: "bg-zinc-100 text-zinc-500",
};

export default function TransferCard({ transfer }: { transfer: TransferView }) {
  return (
    <Link
      href={`/transfers/${transfer.id}`}
      className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold tracking-tight">
          {transfer.requestingStore.name}
          <span className="font-normal text-zinc-400"> söker från </span>
          {transfer.targetStore?.name ?? transfer.acceptingStore?.name ?? "regionen"}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_STYLE[transfer.status] ?? "bg-zinc-100 text-zinc-600"
          }`}
        >
          {TRANSFER_STATUS_LABELS[transfer.status]}
        </span>
      </div>

      <ul className="mt-2 space-y-0.5 text-sm text-zinc-600">
        {transfer.lines.slice(0, 3).map((line) => (
          <li key={line.id}>
            {line.quantity} {TRANSFER_UNIT_LABELS[line.unit]} · {line.brand} {line.flavor}{" "}
            <span className="text-zinc-400">
              {line.strength} {line.format}
            </span>
          </li>
        ))}
        {transfer.lines.length > 3 ? (
          <li className="text-zinc-400">+{transfer.lines.length - 3} rader till</li>
        ) : null}
      </ul>

      <p className="mt-2 text-xs text-zinc-400">{formatDateTime(transfer.createdAt)}</p>
    </Link>
  );
}
