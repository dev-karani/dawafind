import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError, route } from "@/lib/http";
import { sweepExpired } from "@/lib/services/sweep";

/** Scheduled housekeeping (reservation expiry + prescription retention). Requires `Authorization: Bearer $CRON_SECRET`. */
export const POST = route(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) throw new ApiError(401, "Unauthorized.");
  return { result: await sweepExpired() };
});
