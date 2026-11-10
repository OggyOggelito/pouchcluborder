import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { TRANSFER_STATUS_LABELS, TRANSFER_UNIT_LABELS } from "@/lib/transfers";
import type { TransferView } from "@/lib/repositories/transfers";

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: "bg-raised text-warning",
  ACCEPTED: "bg-raised text-primary",
  SENT: "bg-raised text-info",
  RECEIVED: "bg-raised text-muted",
  DECLINED: "bg-raised text-danger",
  CANCELLED: "bg-raised text-muted",
};

export default function TransferCard({ transfer }: { transfer: TransferView }) {
  return (
    <Link
      href={`/transfers/${transfer.id}`}
      className="block rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-control"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold tracking-tight">
          {transfer.requestingStore.name}
          <span className="font-normal text-muted"> söker från </span>
          {transfer.targetStore?.name ?? transfer.acceptingStore?.name ?? "regionen"}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_STYLE[transfer.status] ?? "bg-raised text-muted"
          }`}
        >
          {TRANSFER_STATUS_LABELS[transfer.status]}
        </span>
      </div>

      <ul className="mt-2 space-y-0.5 text-sm text-muted">
        {transfer.lines.slice(0, 3).map((line) => (
          <li key={line.id}>
            {line.quantity} {TRANSFER_UNIT_LABELS[line.unit]} · {line.brand} {line.flavor}{" "}
            <span className="text-muted">
              {line.strength} {line.format}
            </span>
          </li>
        ))}
        {transfer.lines.length > 3 ? (
          <li className="text-muted">+{transfer.lines.length - 3} rader till</li>
        ) : null}
      </ul>

      <p className="mt-2 text-xs text-muted">{formatDateTime(transfer.createdAt)}</p>
    </Link>
  );
}
