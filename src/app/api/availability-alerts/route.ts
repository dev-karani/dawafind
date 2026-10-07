import type { NextRequest } from "next/server";
import { badRequest, parseBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { alertCreateSchema } from "@/lib/schemas";
import { areaByKey } from "@/lib/areas";

export const POST = route(async (req: NextRequest) => {
  const me = await requireApi(["PATIENT"]);
  rateLimit(`alert:${me.id}`, 30, 60 * 60_000);
  const { medicineId, area } = await parseBody(req, alertCreateSchema);
  if (area && !areaByKey(area)) throw badRequest("Unknown area.");
  const medicine = await db.medicine.findUnique({ where: { id: medicineId } });
  if (!medicine || medicine.status !== "ACTIVE") throw badRequest("Unknown medicine.");
  const existing = await db.availabilityAlert.findFirst({
    where: { patientId: me.id, medicineId, area: area ?? null, status: "ACTIVE" },
  });
  if (existing) return { alert: existing };
  return { alert: await db.availabilityAlert.create({ data: { patientId: me.id, medicineId, area: area ?? null } }) };
});

export const GET = route(async () => {
  const me = await requireApi(["PATIENT"]);
  return {
    alerts: await db.availabilityAlert.findMany({
      where: { patientId: me.id },
      include: { medicine: true },
      orderBy: { createdAt: "desc" },
    }),
  };
});
