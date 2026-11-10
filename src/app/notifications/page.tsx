import Link from "next/link";
import { markNotificationsReadAction } from "@/lib/notification-actions";
import { formatDateTime } from "@/lib/format";
import { listNotifications } from "@/lib/repositories/notifications";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** In-app only — nothing in this app can send email or push yet. */
export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const notifications = await listNotifications(user.id);
  const unread = notifications.filter((item) => item.readAt === null).length;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Aviseringar</h1>
        {unread > 0 ? (
          <form action={markNotificationsReadAction}>
            <button type="submit" className="text-sm underline underline-offset-4">
              Markera alla som lästa
            </button>
          </form>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        Visas bara i appen — vi skickar varken e-post eller push än.
      </p>

      {notifications.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-control p-6 text-center text-muted">
          Inga aviseringar.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {notifications.map((item) => {
            const body = (
              <>
                <p className={`font-medium ${item.readAt ? "text-muted" : ""}`}>{item.title}</p>
                {item.body ? <p className="mt-0.5 text-sm text-muted">{item.body}</p> : null}
                <p className="mt-1 text-xs text-muted">{formatDateTime(item.createdAt)}</p>
              </>
            );
            const className = `block rounded-2xl border p-4 shadow-sm ${
              item.readAt ? "border-line bg-surface" : "border-primary bg-raised"
            }`;
            return (
              <li key={item.id}>
                {item.linkUrl ? (
                  <Link href={item.linkUrl} className={`${className} transition hover:border-control`}>
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
