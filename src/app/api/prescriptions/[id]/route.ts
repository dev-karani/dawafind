import type { NextRequest } from "next/server";
import { forbidden, parseBody, route } from "@/lib/http";
import { getPharmacyContext, requireApi } from "@/lib/auth/guard";
import { prescriptionPatchSchema } from "@/lib/schemas";
import { deletePrescription, sharePrescription, updatePrescriptionAsPharmacy } from "@/lib/services/prescriptions";

export const PATCH = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const me = await requireApi(["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  const input = await parseBody(req, prescriptionPatchSchema);
  if (me.role === "PATIENT") {
    if (input.action !== "share") throw forbidden();
    return { prescription: await sharePrescription(me.id, params.id, input.pharmacyId) };
  }
  if (input.action === "share") throw forbidden();
  const ctx = (await getPharmacyContext(me))!;
  await updatePrescriptionAsPharmacy(me.id, ctx.pharmacyId, params.id, { action: input.action, note: input.note });
  return { ok: true };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireApi(["PATIENT"]);
  await deletePrescription(me.id, params.id);
  return { ok: true };
});
