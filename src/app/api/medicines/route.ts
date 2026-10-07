import type { NextRequest } from "next/server";
import { route, parseQuery } from "@/lib/http";
import { z } from "zod";
import { db } from "@/lib/db";
import { findMedicines } from "@/lib/services/search";

export const GET = route(async (req: NextRequest) => {
  const { q } = parseQuery(req, z.object({ q: z.string().trim().max(100).optional() }));
  const medicines = q
    ? await findMedicines(q)
    : await db.medicine.findMany({ where: { status: "ACTIVE" }, orderBy: [{ genericName: "asc" }, { strength: "asc" }], take: 200 });
  return { medicines };
});
