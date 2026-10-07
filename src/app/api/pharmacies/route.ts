import type { NextRequest } from "next/server";
import { z } from "zod";
import { route, parseQuery } from "@/lib/http";
import { db } from "@/lib/db";
import { openStatus } from "@/lib/hours";

/** Public list of VERIFIED pharmacies only. */
export const GET = route(async (req: NextRequest) => {
  const { town, q } = parseQuery(req, z.object({ town: z.string().max(80).optional(), q: z.string().trim().max(80).optional() }));
  const pharmacies = await db.pharmacy.findMany({
    where: {
      verificationStatus: "VERIFIED",
      town: town || undefined,
      name: q ? { contains: q, mode: "insensitive" } : undefined,
    },
    select: {
      id: true, name: true, address: true, area: true, town: true, latitude: true, longitude: true, phone: true,
      openingHours: true, deliveryAvailable: true, deliveryFee: true, deliveryEtaMinutes: true, verifiedAt: true,
    },
    orderBy: { name: "asc" },
    take: 100,
  });
  return { pharmacies: pharmacies.map((p) => ({ ...p, verified: true, open: openStatus(p.openingHours) })) };
});
