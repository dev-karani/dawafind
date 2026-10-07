import type { NextRequest } from "next/server";
import { badRequest, notFound, parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requirePharmacyApi } from "@/lib/auth/guard";
import { staffPatchSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

export const PATCH = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const ctx = await requirePharmacyApi({ adminOnly: true });
  await parseBody(req, staffPatchSchema);
  const member = await db.pharmacyStaff.findUnique({ where: { id: params.id } });
  if (!member || member.pharmacyId !== ctx.pharmacyId) throw notFound();
  if (member.userId === ctx.user.id) throw badRequest("You can't remove yourself.");
  await db.$transaction([
    db.pharmacyStaff.update({ where: { id: member.id }, data: { status: "REMOVED" } }),
    db.session.deleteMany({ where: { userId: member.userId } }),
  ]);
  await audit(ctx.user.id, "pharmacy.staff_remove", "User", member.userId, { pharmacyId: ctx.pharmacyId });
  return { ok: true };
});
