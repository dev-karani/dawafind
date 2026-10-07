import type { NextRequest } from "next/server";
import { badRequest, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { getPharmacyContext, requireApi } from "@/lib/auth/guard";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { uploadPrescription } from "@/lib/services/prescriptions";

const select = {
  id: true, status: true, mimeType: true, sizeBytes: true, uploadedAt: true, expiresAt: true, pharmacyId: true, reviewNote: true,
} as const;

export const POST = route(async (req: NextRequest) => {
  const me = await requireApi(["PATIENT"]);
  rateLimit(`rx-upload:${me.id}`, 10, 60 * 60_000);
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw badRequest("The file is too large. The maximum size is 5 MB.");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Please choose a file to upload.");
  const pharmacyId = String(form.get("pharmacyId") ?? "") || null;
  const consent = form.get("consent") === "on" || form.get("consent") === "true";
  const rx = await uploadPrescription(me.id, Buffer.from(await file.arrayBuffer()), { pharmacyId, consent });
  return { prescription: { id: rx.id, status: rx.status, expiresAt: rx.expiresAt } };
});

export const GET = route(async () => {
  const me = await requireApi(["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  if (me.role === "PATIENT") {
    return { prescriptions: await db.prescription.findMany({ where: { patientId: me.id, deletedAt: null }, select, orderBy: { uploadedAt: "desc" } }) };
  }
  const ctx = (await getPharmacyContext(me))!;
  return {
    prescriptions: await db.prescription.findMany({
      where: { pharmacyId: ctx.pharmacyId, deletedAt: null },
      select: { ...select, patient: { select: { fullName: true } } },
      orderBy: { uploadedAt: "desc" },
    }),
  };
});
