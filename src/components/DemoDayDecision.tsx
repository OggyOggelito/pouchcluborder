import ConfirmButton from "@/components/ui/ConfirmButton";
import { decideDemoDayAction } from "@/lib/demo-day-actions";

/**
 * Confirm or decline one store's demo day.
 *
 * Two buttons and an optional reason. The reason goes to the supplier as
 * written, so the label says so — it is a note from the shop, not an internal
 * one.
 */
export default function DemoDayDecision({
  bookingId,
  brandName,
  storeName,
  back,
}: {
  bookingId: string;
  brandName: string;
  storeName: string;
  back: string;
}) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <form action={decideDemoDayAction}>
        <input type="hidden" name="id" value={bookingId} />
        <input type="hidden" name="back" value={back} />

        <label className="block text-sm">
          <span className="block font-medium">Meddelande till leverantören (frivilligt)</span>
          <input
            name="note"
            maxLength={200}
            placeholder="T.ex. kom in via lastkajen"
            className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
          />
        </label>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            name="to"
            value="CONFIRMED"
            className="min-h-tap flex-1 rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99]"
          >
            Ja, {brandName} är välkomna
          </button>
          <ConfirmButton
            className="min-h-tap flex-1 rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
            title="Neka demodagen?"
            body={`${brandName} får veta att ${storeName} inte kan ta emot den dagen.`}
            confirmLabel="Neka"
            tone="neutral"
            name="to"
            value="DECLINED"
          >
            Nej, inte den dagen
          </ConfirmButton>
        </div>
      </form>
    </div>
  );
}
