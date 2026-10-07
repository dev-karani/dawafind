import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { verifyPassword } from "@/lib/auth/password";
import { destroySession } from "@/lib/auth/session";
import { secureDelete } from "@/lib/storage";
import { audit } from "@/lib/audit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("withdraw_consent") }),
  z.object({ action: z.literal("delete_account"), password: z.string().min(1).max(128) }),
]);

export const POST = route(async (req: NextRequest) => {
  const me = await requireApi(["PATIENT"]);
  const input = await parseBody(req, schema);

  const deleteAllPrescriptions = async () => {
    const rx = await db.prescription.findMany({ where: { patientId: me.id, deletedAt: null } });
    for (const p of rx) {
      await secureDelete(p.fileReference);
      await db.prescription.update({ where: { id: p.id }, data: { deletedAt: new Date(), status: "EXPIRED", pharmacyId: null } });
    }
    return rx.length;
  };

  if (input.action === "withdraw_consent") {
    const n = await deleteAllPrescriptions();
    await db.patientProfile.update({ where: { userId: me.id }, data: { healthDataConsentAt: null } });
    await audit(me.id, "privacy.withdraw_consent", "User", me.id, { prescriptionsDeleted: n });
    return { ok: true, deleted: n };
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(input.password, user.passwordHash))) throw new ApiError(400, "Incorrect password.");
  const n = await deleteAllPrescriptions();
  // Anonymise the account; keep transactional rows required for pharmacy records but drop identifiers.
  await db.$transaction([
    db.session.deleteMany({ where: { userId: me.id } }),
    db.availabilityAlert.deleteMany({ where: { patientId: me.id } }),
    db.savedPharmacy.deleteMany({ where: { patientId: me.id } }),
    db.notification.deleteMany({ where: { userId: me.id } }),
    db.searchEvent.deleteMany({ where: { userId: me.id } }),
    db.user.update({
      where: { id: me.id },
      data: { status: "DELETED", fullName: "Deleted user", email: `deleted+${me.id}@dawafind.invalid`, phone: null, passwordHash: "!" },
    }),
  ]);
  await audit(me.id, "privacy.delete_account", "User", me.id, { prescriptionsDeleted: n });
  await destroySession();
  return { ok: true, redirect: "/" };
});
