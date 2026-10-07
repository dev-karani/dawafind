import type { NextRequest } from "next/server";
import type { VerificationStatus } from "@prisma/client";
import { badRequest, notFound, parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { adminVerifySchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";
import { notifyPharmacy } from "@/lib/notify";

const RULES: Record<string, { from: VerificationStatus[]; to: VerificationStatus; needsNote?: boolean }> = {
  verify: { from: ["PENDING", "REJECTED"], to: "VERIFIED" },
  reject: { from: ["PENDING", "VERIFIED"], to: "REJECTED", needsNote: true },
  suspend: { from: ["VERIFIED"], to: "SUSPENDED", needsNote: true },
  reinstate: { from: ["SUSPENDED"], to: "VERIFIED" },
};

export const PATCH = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const admin = await requireApi(["PLATFORM_ADMIN"]);
  const { action, note } = await parseBody(req, adminVerifySchema);
  const pharmacy = await db.pharmacy.findUnique({ where: { id: params.id } });
  if (!pharmacy) throw notFound("Pharmacy not found.");
  const rule = RULES[action];
  if (!rule.from.includes(pharmacy.verificationStatus)) {
    throw badRequest(`A ${pharmacy.verificationStatus.toLowerCase()} pharmacy cannot be moved to “${action}”.`);
  }
  if (rule.needsNote && !note) throw badRequest("Please provide a reason; it is shared with the pharmacy.");

  const updated = await db.pharmacy.update({
    where: { id: pharmacy.id },
    data: {
      verificationStatus: rule.to,
      verificationNote: note ?? null,
      verifiedAt: rule.to === "VERIFIED" ? new Date() : pharmacy.verifiedAt,
    },
  });
  await audit(admin.id, `pharmacy.${action}`, "Pharmacy", pharmacy.id, { from: pharmacy.verificationStatus, to: rule.to, note: note ?? null });
  await notifyPharmacy(pharmacy.id, {
    type: "SYSTEM",
    title: `Pharmacy ${rule.to.toLowerCase()}`,
    message:
      rule.to === "VERIFIED"
        ? "Your pharmacy is now verified and visible to patients. Add your inventory to start receiving requests."
        : `Your pharmacy status is now ${rule.to.toLowerCase()}.${note ? ` Reason: ${note}` : ""}`,
    link: "/pharmacy",
  });
  return { pharmacy: updated };
});
