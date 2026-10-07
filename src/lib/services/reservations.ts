import { db } from "../db";
import { audit } from "../audit";
import { notify, notifyPharmacy } from "../notify";
import { badRequest, conflict, forbidden, notFound } from "../http";
import { effectivePrice } from "../pricing";
import { medicineLabel } from "../medicine";
import { availableQuantity } from "./inventory";
import { getSettings } from "./settings";
import { deriveStockStatus } from "../pricing";

const MAX_ACTIVE_RESERVATIONS = 10;

export async function createReservation(
  patientId: string,
  input: { pharmacyId: string; medicineId: string; quantity: number; note?: string },
) {
  const pharmacy = await db.pharmacy.findUnique({ where: { id: input.pharmacyId } });
  if (!pharmacy || pharmacy.verificationStatus !== "VERIFIED") throw notFound("Pharmacy not found.");
  const item = await db.inventoryItem.findUnique({
    where: { pharmacyId_medicineId: { pharmacyId: input.pharmacyId, medicineId: input.medicineId } },
    include: { medicine: true },
  });
  if (!item) throw notFound("This pharmacy does not list that medicine.");
  if (item.stockStatus === "OUT_OF_STOCK") throw badRequest("This medicine is currently marked out of stock at this pharmacy.");

  const available = await availableQuantity(db, item);
  if (input.quantity > available) {
    throw badRequest(`Only ${available} unit${available === 1 ? "" : "s"} can currently be reserved. Try a smaller quantity or request stock confirmation.`);
  }

  const active = await db.reservation.count({
    where: { patientId, status: { in: ["PENDING", "CONFIRMED"] } },
  });
  if (active >= MAX_ACTIVE_RESERVATIONS) throw conflict("You have too many active reservations. Please collect or cancel some first.");
  const dup = await db.reservation.findFirst({
    where: {
      patientId,
      pharmacyId: input.pharmacyId,
      medicineId: input.medicineId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });
  if (dup) throw conflict("You already have an active reservation for this medicine at this pharmacy.");

  const settings = await getSettings();
  const unitPrice = effectivePrice(item);
  const reservation = await db.reservation.create({
    data: {
      patientId,
      pharmacyId: input.pharmacyId,
      medicineId: input.medicineId,
      quantity: input.quantity,
      unitPrice,
      serviceFee: settings.serviceFee,
      totalPrice: unitPrice * input.quantity + settings.serviceFee,
      note: input.note || null,
      expiresAt: new Date(Date.now() + settings.pendingReservationTtlMins * 60000),
    },
  });
  await notifyPharmacy(input.pharmacyId, {
    type: "RESERVATION_REQUEST",
    title: "New reservation request",
    message: `${input.quantity} × ${medicineLabel(item.medicine)} requested for collection.`,
    link: "/pharmacy/reservations",
  });
  return reservation;
}

type PharmacyAction = "confirm" | "reject" | "collect" | "expire";
type PatientAction = "cancel";

export async function updateReservationAsPharmacy(
  userId: string,
  pharmacyId: string,
  id: string,
  input: { action: PharmacyAction; holdHours?: number; reason?: string },
) {
  const r = await db.reservation.findUnique({ where: { id }, include: { medicine: true, pharmacy: true } });
  if (!r || r.pharmacyId !== pharmacyId) throw notFound("Reservation not found.");
  const label = medicineLabel(r.medicine);
  const now = new Date();

  switch (input.action) {
    case "confirm": {
      if (r.status !== "PENDING") throw badRequest("Only pending reservations can be confirmed.");
      if (r.expiresAt < now) throw badRequest("This request has already expired.");
      const item = await db.inventoryItem.findUnique({
        where: { pharmacyId_medicineId: { pharmacyId, medicineId: r.medicineId } },
      });
      if (!item || (await availableQuantity(db, item)) < r.quantity) {
        throw badRequest("You don't have enough unreserved stock for this request. Update your stock or reject it.");
      }
      const hours = input.holdHours ?? 4;
      const expiresAt = new Date(now.getTime() + hours * 3600_000);
      await db.reservation.update({ where: { id }, data: { status: "CONFIRMED", expiresAt } });
      await db.inventoryItem.update({ where: { id: item.id }, data: { lastStockUpdate: now } });
      await audit(userId, "reservation.confirm", "Reservation", id, { pharmacyId, holdHours: hours });
      await notify(r.patientId, {
        type: "RESERVATION_CONFIRMED",
        title: "Reservation confirmed",
        message: `${r.pharmacy.name} is holding ${r.quantity} × ${label} for you until ${expiresAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })}.`,
        link: "/dashboard/reservations",
      });
      break;
    }
    case "reject": {
      if (r.status !== "PENDING") throw badRequest("Only pending reservations can be rejected.");
      await db.reservation.update({ where: { id }, data: { status: "REJECTED", note: input.reason ?? r.note } });
      await audit(userId, "reservation.reject", "Reservation", id, { pharmacyId });
      await notify(r.patientId, {
        type: "RESERVATION_REJECTED",
        title: "Reservation not available",
        message: `${r.pharmacy.name} could not reserve ${label}.${input.reason ? ` Reason: ${input.reason}` : ""} You can compare other pharmacies.`,
        link: `/search?medicineId=${r.medicineId}`,
      });
      break;
    }
    case "collect": {
      if (r.status !== "CONFIRMED") throw badRequest("Only confirmed reservations can be marked as collected.");
      await db.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUnique({
          where: { pharmacyId_medicineId: { pharmacyId, medicineId: r.medicineId } },
        });
        if (item) {
          const quantity = Math.max(0, item.quantity - r.quantity);
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { quantity, stockStatus: deriveStockStatus(quantity), lastStockUpdate: now },
          });
        }
        await tx.reservation.update({ where: { id }, data: { status: "COLLECTED" } });
        await tx.order.create({
          data: {
            patientId: r.patientId,
            pharmacyId,
            reservationId: id,
            fulfilment: "PICKUP",
            subtotal: r.unitPrice * r.quantity,
            serviceFee: r.serviceFee,
            total: r.totalPrice,
            status: "COMPLETED",
            paymentStatus: "PAID",
            completedAt: now,
            items: { create: [{ medicineId: r.medicineId, quantity: r.quantity, unitPrice: r.unitPrice }] },
          },
        });
      });
      await audit(userId, "reservation.collect", "Reservation", id, { pharmacyId });
      await notify(r.patientId, {
        type: "ORDER_UPDATE",
        title: "Collection recorded",
        message: `${r.pharmacy.name} recorded that you collected ${r.quantity} × ${label}.`,
        link: "/dashboard/orders",
      });
      break;
    }
    case "expire": {
      if (r.status !== "PENDING" && r.status !== "CONFIRMED") throw badRequest("This reservation is already closed.");
      await db.reservation.update({ where: { id }, data: { status: "EXPIRED" } });
      await audit(userId, "reservation.expire", "Reservation", id, { pharmacyId });
      await notify(r.patientId, {
        type: "SYSTEM",
        title: "Reservation expired",
        message: `Your reservation for ${label} at ${r.pharmacy.name} has expired.`,
        link: "/dashboard/reservations",
      });
      break;
    }
  }
  return db.reservation.findUnique({ where: { id } });
}

export async function updateReservationAsPatient(
  patientId: string,
  id: string,
  input: { action: PatientAction },
) {
  const r = await db.reservation.findUnique({ where: { id } });
  if (!r || r.patientId !== patientId) throw notFound("Reservation not found.");
  if (input.action !== "cancel") throw forbidden();
  if (r.status !== "PENDING" && r.status !== "CONFIRMED") throw badRequest("This reservation can no longer be cancelled.");
  const updated = await db.reservation.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(patientId, "reservation.cancel", "Reservation", id);
  await notifyPharmacy(r.pharmacyId, {
    type: "SYSTEM",
    title: "Reservation cancelled",
    message: "A patient cancelled a reservation.",
    link: "/pharmacy/reservations",
  });
  return updated;
}
