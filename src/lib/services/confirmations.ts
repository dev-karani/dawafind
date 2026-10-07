import { db } from "../db";
import { audit } from "../audit";
import { notify, notifyPharmacy } from "../notify";
import { badRequest, forbidden, notFound } from "../http";
import { effectivePrice } from "../pricing";
import { medicineLabel } from "../medicine";
import { getSettings } from "./settings";

export async function requestStockConfirmation(
  patientId: string,
  input: { pharmacyId: string; medicineId: string; quantity: number },
) {
  const pharmacy = await db.pharmacy.findUnique({ where: { id: input.pharmacyId } });
  if (!pharmacy || pharmacy.verificationStatus !== "VERIFIED") throw notFound("Pharmacy not found.");
  const item = await db.inventoryItem.findUnique({
    where: { pharmacyId_medicineId: { pharmacyId: input.pharmacyId, medicineId: input.medicineId } },
    include: { medicine: true },
  });
  if (!item) throw notFound("This pharmacy does not list that medicine.");

  const existing = await db.stockConfirmation.findFirst({
    where: {
      patientId,
      pharmacyId: input.pharmacyId,
      medicineId: input.medicineId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });
  if (existing) return existing;

  const settings = await getSettings();
  const conf = await db.stockConfirmation.create({
    data: {
      patientId,
      pharmacyId: input.pharmacyId,
      medicineId: input.medicineId,
      requestedQuantity: input.quantity,
      expiresAt: new Date(Date.now() + settings.stockConfirmationTtlMins * 60000),
    },
  });
  await notifyPharmacy(input.pharmacyId, {
    type: "STOCK_REQUEST",
    title: "Stock confirmation requested",
    message: `A patient asked you to confirm stock and price for ${input.quantity} × ${medicineLabel(item.medicine)}.`,
    link: "/pharmacy/reservations",
  });
  return conf;
}

export async function respondToConfirmation(
  userId: string,
  pharmacyId: string,
  id: string,
  input: { action: "confirm" | "unavailable"; response?: string; markOutOfStock?: boolean },
) {
  const conf = await db.stockConfirmation.findUnique({ where: { id }, include: { medicine: true, pharmacy: true } });
  if (!conf || conf.pharmacyId !== pharmacyId) throw notFound("Request not found.");
  if (conf.status !== "PENDING") throw badRequest("This request has already been answered or has expired.");
  if (conf.expiresAt < new Date()) {
    await db.stockConfirmation.update({ where: { id }, data: { status: "EXPIRED" } });
    throw badRequest("This request has expired.");
  }
  if (conf.pharmacy.verificationStatus !== "VERIFIED") throw forbidden();

  const settings = await getSettings();
  const now = new Date();
  const label = medicineLabel(conf.medicine);

  if (input.action === "confirm") {
    const item = await db.inventoryItem.findUnique({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId: conf.medicineId } },
    });
    const price = item ? effectivePrice(item) : null;
    const expiresAt = new Date(now.getTime() + settings.stockConfirmationTtlMins * 60000);
    await db.stockConfirmation.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        response: input.response ?? null,
        confirmedPrice: price,
        respondedAt: now,
        respondedById: userId,
        expiresAt,
      },
    });
    // Physically verified stock → refresh the freshness timestamp.
    if (item) await db.inventoryItem.update({ where: { id: item.id }, data: { lastStockUpdate: now } });
    await audit(userId, "stock_confirmation.confirm", "StockConfirmation", id, { pharmacyId });
    await notify(conf.patientId, {
      type: "STOCK_CONFIRMED",
      title: "Stock confirmed",
      message: `${conf.pharmacy.name} confirmed ${label}${price ? ` at KSh ${price}` : ""}. Valid until ${expiresAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })}.`,
      link: `/search?medicineId=${conf.medicineId}`,
    });
  } else {
    await db.stockConfirmation.update({
      where: { id },
      data: { status: "UNAVAILABLE", response: input.response ?? null, respondedAt: now, respondedById: userId },
    });
    if (input.markOutOfStock) {
      await db.inventoryItem.updateMany({
        where: { pharmacyId, medicineId: conf.medicineId },
        data: { quantity: 0, stockStatus: "OUT_OF_STOCK", lastStockUpdate: now },
      });
    }
    await audit(userId, "stock_confirmation.unavailable", "StockConfirmation", id, {
      pharmacyId,
      markedOutOfStock: !!input.markOutOfStock,
    });
    await notify(conf.patientId, {
      type: "STOCK_CONFIRMED",
      title: "Medicine unavailable",
      message: `${conf.pharmacy.name} reported that ${label} is currently unavailable. You can compare other pharmacies or set an availability alert.`,
      link: `/search?medicineId=${conf.medicineId}`,
    });
  }
  return db.stockConfirmation.findUnique({ where: { id } });
}
