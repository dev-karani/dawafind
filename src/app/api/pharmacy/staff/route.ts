import type { NextRequest } from "next/server";
import { conflict, parseBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { requirePharmacyApi } from "@/lib/auth/guard";
import { staffInviteSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth/password";
import { createResetToken } from "@/lib/services/accounts";
import { sendMail } from "@/lib/mail";
import { audit } from "@/lib/audit";
import { randomBytes } from "node:crypto";

export const GET = route(async () => {
  const ctx = await requirePharmacyApi({ adminOnly: true });
  const staff = await db.pharmacyStaff.findMany({
    where: { pharmacyId: ctx.pharmacyId, status: "ACTIVE" },
    include: { user: { select: { id: true, fullName: true, email: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });
  return { staff };
});

/** A pharmacy admin invites a colleague: an account is created and they set their own password via email. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await requirePharmacyApi({ adminOnly: true });
  rateLimit(`invite:${ctx.user.id}`, 20, 60 * 60_000);
  const input = await parseBody(req, staffInviteSchema);
  if (await db.user.findUnique({ where: { email: input.email } })) throw conflict("A DawaFind account with that email already exists.");

  const user = await db.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
      staffMemberships: { create: { pharmacyId: ctx.pharmacyId, role: input.role } },
    },
  });
  const token = await createResetToken(user.id, 72);
  const pharmacy = await db.pharmacy.findUniqueOrThrow({ where: { id: ctx.pharmacyId }, select: { name: true } });
  const base = process.env.APP_URL || "http://localhost:3000";
  await sendMail(
    user.email,
    `You've been invited to ${pharmacy.name} on DawaFind`,
    `${ctx.user.fullName} invited you to manage ${pharmacy.name} on DawaFind.\nSet your password within 3 days:\n${base}/reset-password?token=${token}`,
  );
  await audit(ctx.user.id, "pharmacy.staff_invite", "User", user.id, { pharmacyId: ctx.pharmacyId, role: input.role });
  return { ok: true };
});
