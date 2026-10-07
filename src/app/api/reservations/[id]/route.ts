import type { NextRequest } from "next/server";
import { forbidden, parseBody, route } from "@/lib/http";
import { getPharmacyContext, requireApi } from "@/lib/auth/guard";
import { reservationPatchSchema } from "@/lib/schemas";
import { updateReservationAsPatient, updateReservationAsPharmacy } from "@/lib/services/reservations";

export const PATCH = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const me = await requireApi(["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  const input = await parseBody(req, reservationPatchSchema);

  if (me.role === "PATIENT") {
    if (input.action !== "cancel") throw forbidden();
    return { reservation: await updateReservationAsPatient(me.id, params.id, { action: "cancel" }) };
  }
  if (input.action === "cancel") throw forbidden("Pharmacies should reject or expire a reservation.");
  const ctx = (await getPharmacyContext(me))!;
  return {
    reservation: await updateReservationAsPharmacy(me.id, ctx.pharmacyId, params.id, {
      action: input.action,
      holdHours: input.holdHours,
      reason: input.reason,
    }),
  };
});
