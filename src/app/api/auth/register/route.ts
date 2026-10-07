import type { NextRequest } from "next/server";
import { route, parseBody, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { registerSchema } from "@/lib/schemas";
import { registerAccount } from "@/lib/services/accounts";
import { createSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guard";

export const POST = route(async (req: NextRequest) => {
  rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  const input = await parseBody(req, registerSchema);
  const user = await registerAccount(input);
  await createSession(user.id);
  return { ok: true, redirect: homeFor(user.role) };
});
