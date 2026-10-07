import type { NextRequest } from "next/server";
import { z } from "zod";
import { notFound, parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";

const schema = z.object({ pharmacyId: z.string().min(10).max(40) });

export const POST = route(async (req: NextRequest) => {
  const me = await requireApi(["PATIENT"]);
  const { pharmacyId } = await parseBody(req, schema);
  const p = await db.pharmacy.findUnique({ where: { id: pharmacyId }, select: { verificationStatus: true } });
  if (!p || p.verificationStatus !== "VERIFIED") throw notFound("Pharmacy not found.");
  await db.savedPharmacy.upsert({
    where: { patientId_pharmacyId: { patientId: me.id, pharmacyId } },
    update: {},
    create: { patientId: me.id, pharmacyId },
  });
  return { ok: true };
});

export const DELETE = route(async (req: NextRequest) => {
  const me = await requireApi(["PATIENT"]);
  const { pharmacyId } = await parseBody(req, schema);
  await db.savedPharmacy.deleteMany({ where: { patientId: me.id, pharmacyId } });
  return { ok: true };
});
