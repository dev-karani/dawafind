import type { Fulfilment, StockStatus } from "@prisma/client";

/** Prices are whole Kenyan shillings. */
export interface PricingFields {
  price: number;
  minimumPrice: number;
  promoPrice?: number | null;
  promotionsEnabled?: boolean;
}

/** Quantity at or below this is reported as LIMITED. */
export const LIMITED_THRESHOLD = 10;

export function deriveStockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= LIMITED_THRESHOLD) return "LIMITED";
  return "IN_STOCK";
}

/**
 * Pharmacy price protection: validates a pricing configuration.
 * Returns an error message, or null when the configuration is valid.
 */
export function validatePricing(p: PricingFields): string | null {
  if (!Number.isInteger(p.price) || p.price <= 0) return "Price must be a positive whole number of shillings.";
  if (!Number.isInteger(p.minimumPrice) || p.minimumPrice <= 0)
    return "Minimum acceptable price must be a positive whole number of shillings.";
  if (p.minimumPrice > p.price) return "Minimum acceptable price cannot be higher than the selling price.";
  if (p.promoPrice != null) {
    if (!Number.isInteger(p.promoPrice) || p.promoPrice <= 0) return "DawaFind price must be a positive whole number.";
    if (p.promoPrice < p.minimumPrice)
      return `A DawaFind price of KSh ${p.promoPrice} is below your minimum acceptable price of KSh ${p.minimumPrice}. Promotion rejected.`;
    if (p.promoPrice > p.price) return "DawaFind price cannot be higher than the normal selling price.";
  }
  return null;
}

/**
 * The price a patient actually sees. A promotion is applied only when it is enabled,
 * is a real discount, and NEVER goes below the pharmacy's minimum acceptable price.
 */
export function effectivePrice(p: PricingFields): number {
  if (
    p.promotionsEnabled &&
    p.promoPrice != null &&
    p.promoPrice >= p.minimumPrice &&
    p.promoPrice < p.price
  ) {
    return p.promoPrice;
  }
  return p.price;
}

export type DiscountResult = { ok: true; price: number } | { ok: false; reason: string };

/** Compute a discounted price, rejecting any discount that would breach the floor. */
export function applyDiscount(
  p: Pick<PricingFields, "price" | "minimumPrice">,
  discount: { percent?: number; amount?: number },
): DiscountResult {
  let off = 0;
  if (discount.percent != null) off = Math.round((p.price * discount.percent) / 100);
  else if (discount.amount != null) off = Math.round(discount.amount);
  if (off < 0 || !Number.isFinite(off)) return { ok: false, reason: "Invalid discount." };
  const next = p.price - off;
  if (next < p.minimumPrice) {
    return {
      ok: false,
      reason: `Discount rejected: KSh ${next} would be below the minimum acceptable price of KSh ${p.minimumPrice}.`,
    };
  }
  return { ok: true, price: next };
}

export interface CostBreakdown {
  medicine: number;
  delivery: number;
  service: number;
  total: number;
}

/** totalCost = medicinePrice (+ deliveryFee when delivering) + DawaFind service fee. */
export function computeCost(args: {
  unitPrice: number;
  quantity?: number;
  fulfilment: Fulfilment;
  deliveryFee: number;
  serviceFee: number;
}): CostBreakdown {
  const medicine = args.unitPrice * (args.quantity ?? 1);
  const delivery = args.fulfilment === "DELIVERY" ? args.deliveryFee : 0;
  const service = args.serviceFee;
  return { medicine, delivery, service, total: medicine + delivery + service };
}

export const ksh = (n: number) => `KSh ${n.toLocaleString("en-KE")}`;
