import type { NextRequest } from "next/server";
import { parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { medicinePatchSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

export const PATCH = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const admin = await requireApi(["PLATFORM_ADMIN"]);
  const input = await parseBody(req, medicinePatchSchema);
  const medicine = await db.medicine.update({ where: { id: params.id }, data: input });
  await audit(admin.id, "medicine.update", "Medicine", medicine.id, { fields: Object.keys(input) });
  return { medicine };
});
