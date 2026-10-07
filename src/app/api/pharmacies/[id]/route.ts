import { notFound, route } from "@/lib/http";
import { db } from "@/lib/db";
import { openStatus } from "@/lib/hours";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const p = await db.pharmacy.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, address: true, area: true, town: true, latitude: true, longitude: true, phone: true, email: true,
      openingHours: true, deliveryAvailable: true, deliveryFee: true, deliveryEtaMinutes: true, verificationStatus: true, verifiedAt: true,
    },
  });
  // Unverified pharmacies are not publicly visible at all.
  if (!p || p.verificationStatus !== "VERIFIED") throw notFound("Pharmacy not found.");
  const { verificationStatus: _v, ...rest } = p;
  return { pharmacy: { ...rest, verified: true, open: openStatus(p.openingHours) } };
});
