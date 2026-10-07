import { notFound, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";

export const PATCH = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireApi();
  const res = await db.notification.updateMany({ where: { id: params.id, userId: me.id }, data: { read: true } });
  if (res.count === 0) throw notFound();
  return { ok: true };
});
