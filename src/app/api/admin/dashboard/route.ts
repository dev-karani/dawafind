import { route } from "@/lib/http";
import { requireApi } from "@/lib/auth/guard";
import { platformOverview } from "@/lib/services/analytics";

export const GET = route(async () => {
  await requireApi(["PLATFORM_ADMIN"]);
  return { overview: await platformOverview() };
});
