import { notFound, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireApi(["PATIENT"]);
  const res = await db.availabilityAlert.updateMany({ where: { id: params.id, patientId: me.id }, data: { status: "CANCELLED" } });
  if (res.count === 0) throw notFound();
  return { ok: true };
});
