import { route } from "@/lib/http";
import { requireApi } from "@/lib/auth/guard";
import { sweepExpired } from "@/lib/services/sweep";

export const POST = route(async () => {
  await requireApi(["PLATFORM_ADMIN"]);
  return { result: await sweepExpired() };
});
