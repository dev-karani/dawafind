import type { NextRequest } from "next/server";
import { route, parseQuery, clientIp, notFound } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { searchQuerySchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { compareMedicine, findMedicines } from "@/lib/services/search";

export const GET = route(async (req: NextRequest) => {
  rateLimit(`search:${clientIp(req)}`, 120, 60_000);
  const p = parseQuery(req, searchQuerySchema);
  if (!p.medicineId) {
    return { medicines: p.q ? await findMedicines(p.q) : [] };
  }
  const medicine = await db.medicine.findUnique({ where: { id: p.medicineId } });
  if (!medicine || medicine.status !== "ACTIVE") throw notFound("Medicine not found.");
  const user = await getCurrentUser();
  const result = await compareMedicine({
    medicineId: medicine.id,
    area: p.area,
    lat: p.lat,
    lng: p.lng,
    radiusKm: p.radius,
    sort: p.sort,
    fulfilment: p.mode,
    userId: user?.role === "PATIENT" ? user.id : null,
    query: p.q ?? "",
  });
  return { medicine, ...result };
});
