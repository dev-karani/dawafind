import type { NextRequest } from "next/server";
import { ApiError, route, parseBody, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { loginSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

export const POST = route(async (req: NextRequest) => {
  const { email, password } = await parseBody(req, loginSchema);
  rateLimit(`login:ip:${clientIp(req)}`, 30, 15 * 60_000);
  rateLimit(`login:email:${email}`, 8, 15 * 60_000);

  const user = await db.user.findUnique({ where: { email } });
  // Always run a bcrypt comparison so response time doesn't reveal whether the account exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) throw new ApiError(401, "Incorrect email or password.");
  if (user.status !== "ACTIVE") throw new ApiError(403, "This account is not active. Please contact DawaFind support.");

  await createSession(user.id);
  await audit(user.id, "user.login", "User", user.id);
  return { ok: true, redirect: homeFor(user.role) };
});
