import type { NextRequest } from "next/server";
import { forbidden, parseBody, route } from "@/lib/http";
import { getPharmacyContext, requireApi } from "@/lib/auth/guard";
import { orderPatchSchema } from "@/lib/schemas";
import { cancelOrderAsPatient, updateOrderAsPharmacy } from "@/lib/services/orders";

export const PATCH = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const me = await requireApi(["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  const input = await parseBody(req, orderPatchSchema);
  if (me.role === "PATIENT") {
    if (input.action !== "cancel") throw forbidden();
    return { order: await cancelOrderAsPatient(me.id, params.id) };
  }
  const ctx = (await getPharmacyContext(me))!;
  return { order: await updateOrderAsPharmacy(me.id, ctx.pharmacyId, params.id, input) };
});
