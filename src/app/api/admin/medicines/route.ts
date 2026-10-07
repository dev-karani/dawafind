import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseBody, parseQuery, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { medicineSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

export const GET = route(async (req: NextRequest) => {
  await requireApi(["PLATFORM_ADMIN"]);
  const { q } = parseQuery(req, z.object({ q: z.string().trim().max(100).optional() }));
  const medicines = await db.medicine.findMany({
    where: q
      ? { OR: [{ genericName: { contains: q, mode: "insensitive" } }, { brandName: { contains: q, mode: "insensitive" } }] }
      : undefined,
    orderBy: [{ genericName: "asc" }, { strength: "asc" }],
    take: 300,
  });
  return { medicines };
});

export const POST = route(async (req: NextRequest) => {
  const admin = await requireApi(["PLATFORM_ADMIN"]);
  const input = await parseBody(req, medicineSchema);
  const medicine = await db.medicine.create({ data: { ...input, brandName: input.brandName ?? null } });
  await audit(admin.id, "medicine.create", "Medicine", medicine.id);
  return { medicine };
});
