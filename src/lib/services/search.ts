import type { Fulfilment, StockStatus } from "@prisma/client";
import { db } from "../db";
import { areaByKey } from "../areas";
import { haversineKm } from "../geo";
import { freshness, stockAgeSentence, type Freshness } from "../freshness";
import { openStatus, type OpenStatus } from "../hours";
import { matchScore, matchesQuery } from "../medicine";
import { computeCost, effectivePrice, type CostBreakdown } from "../pricing";
import { getSettings } from "./settings";

export type SortKey = "price" | "total" | "distance" | "fresh";

export async function findMedicines(query: string) {
  const q = query.trim();
  if (!q) return [];
  const all = await db.medicine.findMany({ where: { status: "ACTIVE" } });
  return all
    .filter((m) => matchesQuery(m, q))
    .sort(
      (a, b) =>
        matchScore(a, q) - matchScore(b, q) ||
        a.genericName.localeCompare(b.genericName) ||
        a.strength.localeCompare(b.strength, undefined, { numeric: true }) ||
        a.dosageForm.localeCompare(b.dosageForm),
    );
}

export interface Offer {
  inventoryId: string;
  pharmacy: {
    id: string;
    name: string;
    address: string;
    area: string;
    town: string;
    phone: string;
    latitude: number;
    longitude: number;
    open: OpenStatus;
  };
  /** Price the patient pays per unit (normal or approved DawaFind price). */
  unitPrice: number;
  normalPrice: number;
  onPromotion: boolean;
  stockStatus: StockStatus;
  availableQuantity: number;
  stockFreshness: Freshness;
  stockSentence: string;
  priceUpdated: string;
  distanceKm: number | null;
  delivery: { available: boolean; fee: number; etaMinutes: number | null };
  pickup: CostBreakdown;
  deliveryCost: CostBreakdown | null;
  /** True when this listing is recent enough to present as available. */
  presentedAsAvailable: boolean;
  lastStockUpdate: Date;
}

export interface CompareOptions {
  medicineId: string;
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
  sort?: SortKey;
  fulfilment?: Fulfilment;
  userId?: string | null;
  query?: string;
}

export interface CompareResult {
  offers: Offer[];
  unavailable: Offer[];
  serviceFee: number;
  origin: { lat: number; lng: number; label: string } | null;
  sort: SortKey;
}

export async function compareMedicine(opts: CompareOptions): Promise<CompareResult> {
  const now = new Date();
  const settings = await getSettings();
  const fulfilment = opts.fulfilment ?? "PICKUP";

  let origin: CompareResult["origin"] = null;
  if (opts.lat != null && opts.lng != null) origin = { lat: opts.lat, lng: opts.lng, label: "your location" };
  else {
    const area = areaByKey(opts.area);
    if (area) origin = { lat: area.lat, lng: area.lng, label: area.label };
  }

  // Only VERIFIED pharmacies are ever listed.
  const items = await db.inventoryItem.findMany({
    where: { medicineId: opts.medicineId, pharmacy: { verificationStatus: "VERIFIED" } },
    include: { pharmacy: true },
  });

  // One grouped query for all live holds instead of one query per pharmacy.
  const holds = await db.reservation.groupBy({
    by: ["pharmacyId"],
    _sum: { quantity: true },
    where: { medicineId: opts.medicineId, status: "CONFIRMED", expiresAt: { gt: now } },
  });
  const held = new Map(holds.map((h) => [h.pharmacyId, h._sum.quantity ?? 0]));

  const rows: Offer[] = [];
  for (const item of items) {
    const ph = item.pharmacy;
    const distanceKm = origin ? haversineKm(origin, { lat: ph.latitude, lng: ph.longitude }) : null;
    if (opts.radiusKm && distanceKm != null && distanceKm > opts.radiusKm) continue;

    const unitPrice = effectivePrice(item);
    const f = freshness(item.lastStockUpdate, now);
    const deliveryOk = ph.deliveryAvailable && item.deliveryAvailable;
    const avail = Math.max(0, item.quantity - (held.get(item.pharmacyId) ?? 0));
    const base = { unitPrice, serviceFee: settings.serviceFee, deliveryFee: ph.deliveryFee };

    rows.push({
      inventoryId: item.id,
      pharmacy: {
        id: ph.id,
        name: ph.name,
        address: ph.address,
        area: ph.area,
        town: ph.town,
        phone: ph.phone,
        latitude: ph.latitude,
        longitude: ph.longitude,
        open: openStatus(ph.openingHours, now),
      },
      unitPrice,
      normalPrice: item.price,
      onPromotion: unitPrice < item.price,
      stockStatus: item.stockStatus,
      availableQuantity: avail,
      stockFreshness: f,
      stockSentence: stockAgeSentence(f),
      priceUpdated: freshness(item.lastPriceUpdate, now).ago,
      distanceKm,
      delivery: { available: deliveryOk, fee: ph.deliveryFee, etaMinutes: ph.deliveryEtaMinutes },
      pickup: computeCost({ ...base, fulfilment: "PICKUP" }),
      deliveryCost: deliveryOk ? computeCost({ ...base, fulfilment: "DELIVERY" }) : null,
      presentedAsAvailable: item.stockStatus !== "OUT_OF_STOCK" && f.level !== "STALE" && avail > 0,
      lastStockUpdate: item.lastStockUpdate,
    });
  }

  const sort: SortKey = opts.sort ?? (origin ? "distance" : "total");
  const costOf = (o: Offer) => (fulfilment === "DELIVERY" ? (o.deliveryCost?.total ?? Infinity) : o.pickup.total);
  const cmp: Record<SortKey, (a: Offer, b: Offer) => number> = {
    price: (a, b) => a.unitPrice - b.unitPrice,
    total: (a, b) => costOf(a) - costOf(b),
    distance: (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    fresh: (a, b) => b.lastStockUpdate.getTime() - a.lastStockUpdate.getTime(),
  };
  // Neutral tie-break (alphabetical) so there is never a hidden "best pharmacy" ranking.
  const sorter = (a: Offer, b: Offer) => cmp[sort](a, b) || a.pharmacy.name.localeCompare(b.pharmacy.name);

  let listed = rows.filter((r) => r.stockStatus !== "OUT_OF_STOCK");
  if (fulfilment === "DELIVERY") listed = listed.filter((r) => r.delivery.available);
  const unavailable = rows.filter((r) => r.stockStatus === "OUT_OF_STOCK").sort(sorter);

  const result: CompareResult = { offers: listed.sort(sorter), unavailable, serviceFee: settings.serviceFee, origin, sort };

  // Record search + pharmacy impressions (powers analytics and the primary success metric).
  const foundVerifiedAvailable = listed.some((r) => r.presentedAsAvailable);
  await db.searchEvent.create({
    data: {
      userId: opts.userId ?? null,
      query: (opts.query ?? "").slice(0, 120),
      medicineId: opts.medicineId,
      area: opts.area ?? null,
      resultCount: listed.length,
      foundVerifiedAvailable,
    },
  });
  if (rows.length) {
    await db.pharmacyImpression.createMany({
      data: rows.map((r) => ({
        pharmacyId: r.pharmacy.id,
        medicineId: opts.medicineId,
        kind: "SEARCH_APPEARANCE" as const,
      })),
    });
  }
  return result;
}
