"use client";

import { useRouter, useSearchParams } from "next/navigation";
import DemoDayForm from "@/components/supplier/DemoDayForm";
import type { StoreOption } from "@/lib/demo-days";

/**
 * Keeps the chosen date in the URL.
 *
 * Which stores can be booked depends entirely on the date — opening hours,
 * exceptions and who already has the day — so the options are resolved on the
 * server and the date is a query parameter rather than client state.
 */
export default function DemoDayBooker({
  date,
  options,
  min,
  max,
}: {
  date: string;
  options: StoreOption[];
  min: string;
  max: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <DemoDayForm
      date={date}
      options={options}
      min={min}
      max={max}
      onDateChange={(next) => {
        const search = new URLSearchParams(params.toString());
        search.set("datum", next);
        router.replace(`/supplier/boka?${search.toString()}`);
      }}
    />
  );
}
