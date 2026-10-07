import type { NextRequest } from "next/server";
import { parseBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { getPharmacyContext, requireApi } from "@/lib/auth/guard";
import { reservationCreateSchema } from "@/lib/schemas";
import { createReservation } from "@/lib/services/reservations";
import { sweepExpired } from "@/lib/services/sweep";

export const POST = route(async (req: NextRequest) => {
  const me = await requireApi(["PATIENT"]);
  rateLimit(`reserve:${me.id}`, 20, 60 * 60_000);
  const input = await parseBody(req, reservationCreateSchema);
  return { reservation: await createReservation(me.id, input) };
});

export const GET = route(async () => {
  const me = await requireApi(["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  await sweepExpired();
  if (me.role === "PATIENT") {
    return {
      reservations: await db.reservation.findMany({
        where: { patientId: me.id },
        include: { medicine: true, pharmacy: { select: { id: true, name: true, area: true, phone: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  const ctx = (await getPharmacyContext(me))!;
  return {
    reservations: await db.reservation.findMany({
      where: { pharmacyId: ctx.pharmacyId },
      include: { medicine: true, patient: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  };
});
