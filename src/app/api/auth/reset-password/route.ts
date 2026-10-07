import type { NextRequest } from "next/server";
import { badRequest, route, parseBody, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { resetSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { sha256 } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const POST = route(async (req: NextRequest) => {
  rateLimit(`reset:${clientIp(req)}`, 10, 60 * 60_000);
  const { token, password } = await parseBody(req, resetSchema);
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest("This reset link is invalid or has expired. Please request a new one.");
  }
  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Sign out everywhere after a reset.
    db.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await audit(record.userId, "user.password_reset", "User", record.userId);
  return { ok: true, redirect: "/login" };
});
