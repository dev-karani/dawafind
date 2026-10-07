import type { NextRequest } from "next/server";
import { parseBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { requireApi, getPharmacyContext } from "@/lib/auth/guard";
import { confirmationCreateSchema } from "@/lib/schemas";
import { requestStockConfirmation } from "@/lib/services/confirmations";
import { sweepExpired } from "@/lib/services/sweep";

export const POST = route(async (req: NextRequest) => {
  const me = await requireApi(["PATIENT"]);
  rateLimit(`confirm:${me.id}`, 30, 60 * 60_000);
  const input = await parseBody(req, confirmationCreateSchema);
  const confirmation = await requestStockConfirmation(me.id, input);
  return { confirmation };
});

export const GET = route(async () => {
  const me = await requireApi(["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  await sweepExpired();
  if (me.role === "PATIENT") {
    return {
      confirmations: await db.stockConfirmation.findMany({
        where: { patientId: me.id },
        include: { medicine: true, pharmacy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    };
  }
  const ctx = (await getPharmacyContext(me))!;
  return {
    confirmations: await db.stockConfirmation.findMany({
      where: { pharmacyId: ctx.pharmacyId },
      include: { medicine: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  };
});
