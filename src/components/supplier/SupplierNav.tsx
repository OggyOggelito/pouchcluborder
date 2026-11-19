"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supplierLogoutAction } from "@/lib/supplier-auth-actions";

/**
 * The supplier's whole navigation.
 *
 * Written here rather than read from src/config/navigation.ts. That file is
 * the staff menu, and a shared config is one `roles: ALL_ROLES` away from
 * putting an internal page in front of an external person. Three
 * destinations, and the fourth only when statistics are switched on.
 */
const ITEMS = [
  { href: "/supplier", label: "Start" },
  { href: "/supplier/boka", label: "Boka demodag" },
  { href: "/supplier/bokningar", label: "Mina bokningar" },
  { href: "/supplier/stats", label: "Statistik" },
] as const;

export default function SupplierNav({ showStats = true }: { showStats?: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => showStats || item.href !== "/supplier/stats");

  return (
    <nav
      aria-label="Leverantörsmeny"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {items.map((item) => {
          const active =
            item.href === "/supplier" ? pathname === "/supplier" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-center text-xs font-medium transition ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-0.5 w-8 rounded-full ${active ? "bg-primary" : "bg-transparent"}`}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <form action={supplierLogoutAction} className="h-full">
            <button
              type="submit"
              className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-center text-xs font-medium text-muted"
            >
              <span aria-hidden className="h-0.5 w-8 rounded-full bg-transparent" />
              Logga ut
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
