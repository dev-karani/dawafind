import { notFound, route } from "@/lib/http";
import { db } from "@/lib/db";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const medicine = await db.medicine.findUnique({ where: { id: params.id } });
  if (!medicine || medicine.status !== "ACTIVE") throw notFound("Medicine not found.");
  const pharmacies = await db.inventoryItem.count({
    where: { medicineId: medicine.id, stockStatus: { not: "OUT_OF_STOCK" }, pharmacy: { verificationStatus: "VERIFIED" } },
  });
  return { medicine, participatingPharmacies: pharmacies };
});
