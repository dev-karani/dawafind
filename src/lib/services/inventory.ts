import type { InventoryItem } from "@prisma/client";
import { db, type Db } from "../db";
import { audit } from "../audit";
import { notify } from "../notify";
import { areaByKey } from "../areas";
import { haversineKm } from "../geo";
import { badRequest, conflict, forbidden, notFound } from "../http";
import { deriveStockStatus, validatePricing } from "../pricing";
import { medicineLabel } from "../medicine";

/** Units promised to patients through live CONFIRMED reservations. */
export async function reservedQuantity(client: Db, pharmacyId: string, medicineId: string): Promise<number> {
  const agg = await client.reservation.aggregate({
    _sum: { quantity: true },
    where: { pharmacyId, medicineId, status: "CONFIRMED", expiresAt: { gt: new Date() } },
  });
  return agg._sum.quantity ?? 0;
}

export async function availableQuantity(client: Db, item: Pick<InventoryItem, "pharmacyId" | "medicineId" | "quantity">) {
  return Math.max(0, item.quantity - (await reservedQuantity(client, item.pharmacyId, item.medicineId)));
}

async function assertVerified(pharmacyId: string) {
  const p = await db.pharmacy.findUnique({ where: { id: pharmacyId }, select: { verificationStatus: true } });
  if (!p) throw notFound("Pharmacy not found.");
  if (p.verificationStatus !== "VERIFIED") {
    throw forbidden("Your pharmacy must be verified by DawaFind before you can list inventory.");
  }
}

export interface CreateInventoryInput {
  medicineId: string;
  quantity: number;
  price: number;
  minimumPrice: number;
  promoPrice?: number | null;
  promotionsEnabled?: boolean;
  deliveryAvailable?: boolean;
}

export async function createInventoryItem(userId: string, pharmacyId: string, input: CreateInventoryInput) {
  await assertVerified(pharmacyId);
  const medicine = await db.medicine.findUnique({ where: { id: input.medicineId } });
  if (!medicine || medicine.status !== "ACTIVE") throw badRequest("That medicine is not in the DawaFind catalogue.");
  const err = validatePricing(input);
  if (err) throw badRequest(err);
  const existing = await db.inventoryItem.findUnique({
    where: { pharmacyId_medicineId: { pharmacyId, medicineId: input.medicineId } },
  });
  if (existing) throw conflict("This medicine is already in your inventory. Edit the existing entry instead.");

  const item = await db.inventoryItem.create({
    data: {
      pharmacyId,
      medicineId: input.medicineId,
      quantity: input.quantity,
      price: input.price,
      minimumPrice: input.minimumPrice,
      promoPrice: input.promoPrice ?? null,
      promotionsEnabled: input.promotionsEnabled ?? false,
      deliveryAvailable: input.deliveryAvailable ?? false,
      stockStatus: deriveStockStatus(input.quantity),
    },
  });
  await audit(userId, "inventory.create", "InventoryItem", item.id, {
    pharmacyId,
    medicineId: input.medicineId,
    quantity: input.quantity,
    price: input.price,
  });
  if (item.stockStatus !== "OUT_OF_STOCK") await triggerAvailabilityAlerts(item.medicineId, pharmacyId);
  return item;
}

export interface UpdateInventoryInput {
  quantity?: number;
  price?: number;
  minimumPrice?: number;
  promoPrice?: number | null;
  promotionsEnabled?: boolean;
  deliveryAvailable?: boolean;
  markOutOfStock?: boolean;
  /** Re-affirm current stock/price without changing anything. */
  refresh?: boolean;
}

export async function updateInventoryItem(userId: string, pharmacyId: string, id: string, patch: UpdateInventoryInput) {
  const item = await db.inventoryItem.findUnique({ where: { id } });
  // Tenant isolation: staff can only touch their own pharmacy's rows. Return 404, not 403, to avoid leaking existence.
  if (!item || item.pharmacyId !== pharmacyId) throw notFound("Inventory item not found.");
  await assertVerified(pharmacyId);

  const next = {
    quantity: patch.markOutOfStock ? 0 : (patch.quantity ?? item.quantity),
    price: patch.price ?? item.price,
    minimumPrice: patch.minimumPrice ?? item.minimumPrice,
    promoPrice: patch.promoPrice === undefined ? item.promoPrice : patch.promoPrice,
    promotionsEnabled: patch.promotionsEnabled ?? item.promotionsEnabled,
    deliveryAvailable: patch.deliveryAvailable ?? item.deliveryAvailable,
  };
  const err = validatePricing(next);
  if (err) throw badRequest(err);

  const now = new Date();
  const priceChanged =
    next.price !== item.price ||
    next.minimumPrice !== item.minimumPrice ||
    next.promoPrice !== item.promoPrice ||
    next.promotionsEnabled !== item.promotionsEnabled;
  const stockChanged = next.quantity !== item.quantity;
  const stockStatus = deriveStockStatus(next.quantity);

  const updated = await db.inventoryItem.update({
    where: { id },
    data: {
      ...next,
      stockStatus,
      lastStockUpdate: stockChanged || patch.refresh ? now : undefined,
      lastPriceUpdate: priceChanged || patch.refresh ? now : undefined,
    },
  });

  if (priceChanged) {
    await audit(userId, "inventory.price_change", "InventoryItem", id, {
      from: { price: item.price, minimumPrice: item.minimumPrice, promoPrice: item.promoPrice, promotionsEnabled: item.promotionsEnabled },
      to: { price: next.price, minimumPrice: next.minimumPrice, promoPrice: next.promoPrice, promotionsEnabled: next.promotionsEnabled },
    });
  }
  if (stockChanged || patch.refresh) {
    await audit(userId, "inventory.stock_change", "InventoryItem", id, {
      from: item.quantity,
      to: next.quantity,
      status: stockStatus,
      refresh: !!patch.refresh,
    });
  }
  if (item.stockStatus === "OUT_OF_STOCK" && stockStatus !== "OUT_OF_STOCK") {
    await triggerAvailabilityAlerts(item.medicineId, pharmacyId);
  }
  return updated;
}

/** When a verified pharmacy goes OUT_OF_STOCK → available, notify matching patients with active alerts. */
export async function triggerAvailabilityAlerts(medicineId: string, pharmacyId: string) {
  const pharmacy = await db.pharmacy.findUnique({ where: { id: pharmacyId } });
  if (!pharmacy || pharmacy.verificationStatus !== "VERIFIED") return;
  const medicine = await db.medicine.findUnique({ where: { id: medicineId } });
  if (!medicine) return;
  const alerts = await db.availabilityAlert.findMany({ where: { medicineId, status: "ACTIVE" } });

  for (const alert of alerts) {
    const area = areaByKey(alert.area);
    if (area && haversineKm(area, { lat: pharmacy.latitude, lng: pharmacy.longitude }) > 15) continue;
    await db.availabilityAlert.update({ where: { id: alert.id }, data: { status: "NOTIFIED", notifiedAt: new Date() } });
    await notify(alert.patientId, {
      type: "STOCK_AVAILABLE",
      title: `${medicineLabel(medicine)} may now be available`,
      message: `${pharmacy.name} (${pharmacy.area}) has reported this medicine as available. Stock can change quickly, so request confirmation before travelling.`,
      link: `/search?medicineId=${medicineId}${alert.area ? `&area=${alert.area}` : ""}`,
    });
  }
}
