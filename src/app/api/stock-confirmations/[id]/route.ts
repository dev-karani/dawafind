import type { NextRequest } from "next/server";
import { parseBody, route } from "@/lib/http";
import { requirePharmacyApi } from "@/lib/auth/guard";
import { confirmationPatchSchema } from "@/lib/schemas";
import { respondToConfirmation } from "@/lib/services/confirmations";

export const PATCH = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const ctx = await requirePharmacyApi();
  const input = await parseBody(req, confirmationPatchSchema);
  return { confirmation: await respondToConfirmation(ctx.user.id, ctx.pharmacyId, params.id, input) };
});
