import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseQuery, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";

export const GET = route(async (req: NextRequest) => {
  await requireApi(["PLATFORM_ADMIN"]);
  const { status } = parseQuery(req, z.object({ status: z.enum(["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]).optional() }));
  const pharmacies = await db.pharmacy.findMany({
    where: { verificationStatus: status },
    include: { staff: { where: { role: "PHARMACY_ADMIN" }, include: { user: { select: { fullName: true, email: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return { pharmacies };
});
