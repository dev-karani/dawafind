import { describe, expect, it } from "vitest";
import { applyDiscount, computeCost, deriveStockStatus, effectivePrice, validatePricing } from "./pricing";

describe("price protection", () => {
  it("rejects a promotion below the minimum acceptable price", () => {
    expect(validatePricing({ price: 500, minimumPrice: 450, promoPrice: 400 })).toMatch(/below your minimum/);
  });

  it("accepts a promotion at or above the minimum", () => {
    expect(validatePricing({ price: 500, minimumPrice: 450, promoPrice: 450 })).toBeNull();
  });

  it("rejects a minimum price above the selling price", () => {
    expect(validatePricing({ price: 400, minimumPrice: 450 })).toMatch(/cannot be higher/);
  });

  it("applyDiscount rejects discounts that breach the floor", () => {
    const r = applyDiscount({ price: 500, minimumPrice: 450 }, { percent: 20 });
    expect(r.ok).toBe(false);
    expect(applyDiscount({ price: 500, minimumPrice: 450 }, { percent: 10 })).toEqual({ ok: true, price: 450 });
    expect(applyDiscount({ price: 500, minimumPrice: 450 }, { amount: 51 }).ok).toBe(false);
  });

  it("never serves a promo price below the minimum even with bad data", () => {
    expect(effectivePrice({ price: 500, minimumPrice: 450, promoPrice: 300, promotionsEnabled: true })).toBe(500);
  });

  it("only applies a promotion when enabled", () => {
    expect(effectivePrice({ price: 500, minimumPrice: 450, promoPrice: 470, promotionsEnabled: false })).toBe(500);
    expect(effectivePrice({ price: 500, minimumPrice: 450, promoPrice: 470, promotionsEnabled: true })).toBe(470);
  });
});

describe("total cost", () => {
  it("pickup = medicine + service fee", () => {
    expect(computeCost({ unitPrice: 450, fulfilment: "PICKUP", deliveryFee: 100, serviceFee: 20 })).toEqual({
      medicine: 450,
      delivery: 0,
      service: 20,
      total: 470,
    });
  });

  it("delivery adds the delivery fee (spec example: 500 + 20 + 100 = 620)", () => {
    expect(computeCost({ unitPrice: 500, fulfilment: "DELIVERY", deliveryFee: 100, serviceFee: 20 }).total).toBe(620);
  });

  it("multiplies medicine cost by quantity but charges the service fee once", () => {
    expect(computeCost({ unitPrice: 100, quantity: 3, fulfilment: "PICKUP", deliveryFee: 0, serviceFee: 20 }).total).toBe(320);
  });
});

describe("stock status", () => {
  it("derives status from quantity", () => {
    expect(deriveStockStatus(0)).toBe("OUT_OF_STOCK");
    expect(deriveStockStatus(5)).toBe("LIMITED");
    expect(deriveStockStatus(50)).toBe("IN_STOCK");
  });
});
