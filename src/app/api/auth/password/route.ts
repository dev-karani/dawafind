import type { NextRequest } from "next/server";
import { ApiError, route, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { changePasswordSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const PATCH = route(async (req: NextRequest) => {
  const me = await requireApi();
  rateLimit(`pwchange:${me.id}`, 5, 15 * 60_000);
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new ApiError(400, "Your current password is incorrect.");
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(newPassword) } });
  // Invalidate every other session, keep the user signed in on this device.
  await destroySession();
  await db.session.deleteMany({ where: { userId: me.id } });
  await createSession(me.id);
  await audit(me.id, "user.password_change", "User", me.id);
  return { ok: true };
});
