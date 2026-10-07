import type { NextRequest } from "next/server";
import { forbidden, notFound, parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getPharmacyContext, requirePharmacyApi } from "@/lib/auth/guard";
import { inventoryCreateSchema } from "@/lib/schemas";
import { createInventoryItem } from "@/lib/services/inventory";
import { effectivePrice } from "@/lib/pricing";
import { freshness } from "@/lib/freshness";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const pharmacy = await db.pharmacy.findUnique({ where: { id: params.id }, select: { verificationStatus: true } });
  if (!pharmacy) throw notFound("Pharmacy not found.");

  const user = await getCurrentUser();
  const ctx = user ? await getPharmacyContext(user) : null;
  const isOwnStaff = ctx?.pharmacyId === params.id;

  if (pharmacy.verificationStatus !== "VERIFIED" && !isOwnStaff) throw notFound("Pharmacy not found.");

  const items = await db.inventoryItem.findMany({
    where: { pharmacyId: params.id },
    include: { medicine: true },
    orderBy: { medicine: { genericName: "asc" } },
  });
  return {
    inventory: items.map((i) => ({
      id: i.id,
      medicine: i.medicine,
      price: effectivePrice(i),
      stockStatus: i.stockStatus,
      lastStockUpdate: i.lastStockUpdate,
      lastPriceUpdate: i.lastPriceUpdate,
      stockFreshness: freshness(i.lastStockUpdate).level,
      deliveryAvailable: i.deliveryAvailable,
      // Cost-sensitive fields are only returned to the pharmacy's own staff.
      ...(isOwnStaff
        ? { quantity: i.quantity, normalPrice: i.price, minimumPrice: i.minimumPrice, promoPrice: i.promoPrice, promotionsEnabled: i.promotionsEnabled }
        : {}),
    })),
  };
});

export const POST = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const ctx = await requirePharmacyApi();
  if (ctx.pharmacyId !== params.id) throw forbidden();
  const input = await parseBody(req, inventoryCreateSchema);
  const item = await createInventoryItem(ctx.user.id, ctx.pharmacyId, input);
  return { inventoryItem: item };
});
