import type { NextRequest } from "next/server";
import { parseBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { getPharmacyContext, requireApi } from "@/lib/auth/guard";
import { orderCreateSchema } from "@/lib/schemas";
import { createDeliveryOrder } from "@/lib/services/orders";

export const POST = route(async (req: NextRequest) => {
  const me = await requireApi(["PATIENT"]);
  rateLimit(`order:${me.id}`, 20, 60 * 60_000);
  const input = await parseBody(req, orderCreateSchema);
  return { order: await createDeliveryOrder(me.id, input) };
});

export const GET = route(async () => {
  const me = await requireApi(["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  if (me.role === "PATIENT") {
    return {
      orders: await db.order.findMany({
        where: { patientId: me.id },
        include: { items: { include: { medicine: true } }, pharmacy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  const ctx = (await getPharmacyContext(me))!;
  return {
    orders: await db.order.findMany({
      where: { pharmacyId: ctx.pharmacyId },
      include: { items: { include: { medicine: true } }, patient: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  };
});
