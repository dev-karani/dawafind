import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseQuery, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";

export const GET = route(async (req: NextRequest) => {
  await requireApi(["PLATFORM_ADMIN"]);
  const { q, role } = parseQuery(
    req,
    z.object({ q: z.string().trim().max(100).optional(), role: z.enum(["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN", "PLATFORM_ADMIN"]).optional() }),
  );
  const users = await db.user.findMany({
    where: {
      role,
      OR: q ? [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] : undefined,
    },
    // passwordHash is never selected.
    select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return { users };
});
