import Link from "next/link";
import { db } from "@/lib/db";
import { ApiButton } from "./client/ApiButton";
import { Card, EmptyState, PageTitle, fmtDateTime } from "./ui";

export async function NotificationList({ userId }: { userId: string }) {
  const items = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  const unread = items.filter((n) => !n.read).length;
  return (
    <div>
      <PageTitle
        title="Notifications"
        subtitle="In-app updates about stock confirmations, reservations, orders and prescriptions."
        action={unread > 0 ? <ApiButton url="/api/notifications" method="PATCH">Mark all as read</ApiButton> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState>No notifications yet.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id}>
              <Card className={n.read ? "" : "border-teal-300 bg-teal-50/40"}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {!n.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-teal-600" aria-label="Unread" />}
                      {n.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-500">{fmtDateTime(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {n.link && <Link href={n.link} className="text-sm text-teal-800 underline">Open</Link>}
                    {!n.read && <ApiButton url={`/api/notifications/${n.id}/read`} method="PATCH">Mark read</ApiButton>}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
