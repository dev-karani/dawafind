import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePharmacyApi } from "@/lib/auth/guard";
import { pharmacySettingsSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/** Pharmacy administrators manage the pharmacy profile and delivery configuration. */
export const PATCH = route(async (req: NextRequest) => {
  const ctx = await requirePharmacyApi({ adminOnly: true });
  const input = await parseBody(req, pharmacySettingsSchema);
  const { openingHours, ...rest } = input;
  await db.pharmacy.update({
    where: { id: ctx.pharmacyId },
    data: { ...rest, ...(openingHours ? { openingHours: openingHours as Prisma.InputJsonValue } : {}) },
  });
  await audit(ctx.user.id, "pharmacy.settings_update", "Pharmacy", ctx.pharmacyId, { fields: Object.keys(input) });
  return { ok: true };
});
