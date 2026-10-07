import type { NextRequest } from "next/server";
import { route, parseBody, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { forgotSchema } from "@/lib/schemas";
import { sendResetEmail } from "@/lib/services/accounts";

export const POST = route(async (req: NextRequest) => {
  rateLimit(`forgot:${clientIp(req)}`, 5, 60 * 60_000);
  const { email } = await parseBody(req, forgotSchema);
  await sendResetEmail(email);
  return { ok: true, message: "If an account exists for that email, we've sent a reset link." };
});
