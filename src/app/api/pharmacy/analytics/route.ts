import { route } from "@/lib/http";
import { requirePharmacyApi } from "@/lib/auth/guard";
import { pharmacyAnalytics, pharmacyOverview } from "@/lib/services/analytics";

export const GET = route(async () => {
  const ctx = await requirePharmacyApi();
  const [overview, analytics] = await Promise.all([pharmacyOverview(ctx.pharmacyId), pharmacyAnalytics(ctx.pharmacyId)]);
  return { overview, analytics };
});
