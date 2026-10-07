import type { NextRequest } from "next/server";
import { parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePharmacyApi } from "@/lib/auth/guard";
import { planSchema } from "@/lib/schemas";
import { PLANS } from "@/lib/services/accounts";
import { audit } from "@/lib/audit";

/**
 * MVP: plan changes are recorded but billing is manual (no payment integration yet).
 * Core features are never blocked on payment.
 */
export const PATCH = route(async (req: NextRequest) => {
  const ctx = await requirePharmacyApi({ adminOnly: true });
  const { planName } = await parseBody(req, planSchema);
  await db.$transaction([
    db.pharmacyPlan.updateMany({ where: { pharmacyId: ctx.pharmacyId, status: "ACTIVE" }, data: { status: "CANCELLED", endDate: new Date() } }),
    db.pharmacyPlan.create({ data: { pharmacyId: ctx.pharmacyId, planName, monthlyFee: PLANS[planName].monthlyFee } }),
  ]);
  await audit(ctx.user.id, "pharmacy.plan_change", "Pharmacy", ctx.pharmacyId, { planName });
  return { ok: true };
});
