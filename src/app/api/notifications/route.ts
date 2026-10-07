import { route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";

export const GET = route(async () => {
  const me = await requireApi();
  const [notifications, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.notification.count({ where: { userId: me.id, read: false } }),
  ]);
  return { notifications, unread };
});

/** Mark everything as read. */
export const PATCH = route(async () => {
  const me = await requireApi();
  await db.notification.updateMany({ where: { userId: me.id, read: false }, data: { read: true } });
  return { ok: true };
});
