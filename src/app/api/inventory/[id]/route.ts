import type { NextRequest } from "next/server";
import { parseBody, route } from "@/lib/http";
import { requirePharmacyApi } from "@/lib/auth/guard";
import { inventoryPatchSchema } from "@/lib/schemas";
import { updateInventoryItem } from "@/lib/services/inventory";

export const PATCH = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const ctx = await requirePharmacyApi();
  const patch = await parseBody(req, inventoryPatchSchema);
  const item = await updateInventoryItem(ctx.user.id, ctx.pharmacyId, params.id, patch);
  return { inventoryItem: item };
});
