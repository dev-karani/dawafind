import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseQuery, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";

export const GET = route(async (req: NextRequest) => {
  await requireApi(["PLATFORM_ADMIN"]);
  const { action, entityType } = parseQuery(
    req,
    z.object({ action: z.string().max(60).optional(), entityType: z.string().max(40).optional() }),
  );
  const logs = await db.auditLog.findMany({
    where: { action: action ? { startsWith: action } : undefined, entityType: entityType || undefined },
    include: { user: { select: { fullName: true, role: true } } },
    orderBy: { timestamp: "desc" },
    take: 200,
  });
  return { logs };
});
