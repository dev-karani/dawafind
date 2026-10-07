import type { OrderStatus } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { notify, notifyPharmacy } from "../notify";
import { badRequest, forbidden, notFound } from "../http";
import { computeCost, deriveStockStatus, effectivePrice } from "../pricing";
import { medicineLabel } from "../medicine";
import { availableQuantity } from "./inventory";
import { getSettings } from "./settings";

export type OrderAction = "accept" | "prepare" | "dispatch" | "complete" | "cancel";

export async function createDeliveryOrder(
  patientId: string,
  input: { pharmacyId: string; medicineId: string; quantity: number; deliveryAddress: string; note?: string },
) {
  const pharmacy = await db.pharmacy.findUnique({ where: { id: input.pharmacyId } });
  if (!pharmacy || pharmacy.verificationStatus !== "VERIFIED") throw notFound("Pharmacy not found.");
  if (!pharmacy.deliveryAvailable) throw badRequest("This pharmacy does not currently offer delivery.");
  const item = await db.inventoryItem.findUnique({
    where: { pharmacyId_medicineId: { pharmacyId: input.pharmacyId, medicineId: input.medicineId } },
    include: { medicine: true },
  });
  if (!item) throw notFound("This pharmacy does not list that medicine.");
  if (!item.deliveryAvailable) throw badRequest("Delivery is not available for this medicine.");
  if (item.stockStatus === "OUT_OF_STOCK") throw badRequest("This medicine is currently marked out of stock.");
  const available = await availableQuantity(db, item);
  if (input.quantity > available) throw badRequest(`Only ${available} unit${available === 1 ? "" : "s"} available for order.`);

  const settings = await getSettings();
  const unitPrice = effectivePrice(item);
  const cost = computeCost({
    unitPrice,
    quantity: input.quantity,
    fulfilment: "DELIVERY",
    deliveryFee: pharmacy.deliveryFee,
    serviceFee: settings.serviceFee,
  });
  const order = await db.order.create({
    data: {
      patientId,
      pharmacyId: input.pharmacyId,
      fulfilment: "DELIVERY",
      subtotal: cost.medicine,
      deliveryFee: cost.delivery,
      serviceFee: cost.service,
      total: cost.total,
      deliveryAddress: input.deliveryAddress,
      note: input.note || null,
      items: { create: [{ medicineId: input.medicineId, quantity: input.quantity, unitPrice }] },
    },
  });
  await notifyPharmacy(input.pharmacyId, {
    type: "ORDER_UPDATE",
    title: "New delivery order",
    message: `${input.quantity} × ${medicineLabel(item.medicine)} — delivery order received.`,
    link: "/pharmacy/orders",
  });
  return order;
}

const NEXT: Record<OrderAction, { from: OrderStatus[]; to: OrderStatus }> = {
  accept: { from: ["PENDING"], to: "ACCEPTED" },
  prepare: { from: ["ACCEPTED"], to: "PREPARING" },
  dispatch: { from: ["PREPARING"], to: "DISPATCHED" },
  complete: { from: ["PREPARING", "DISPATCHED"], to: "COMPLETED" },
  cancel: { from: ["PENDING", "ACCEPTED", "PREPARING", "DISPATCHED"], to: "CANCELLED" },
};

const MESSAGES: Record<OrderStatus, string> = {
  PENDING: "is waiting for the pharmacy",
  ACCEPTED: "was accepted by the pharmacy",
  PREPARING: "is being prepared",
  DISPATCHED: "is on its way",
  COMPLETED: "is complete",
  CANCELLED: "was cancelled",
};

export async function updateOrderAsPharmacy(
  userId: string,
  pharmacyId: string,
  id: string,
  input: { action: OrderAction; reason?: string },
) {
  const order = await db.order.findUnique({ where: { id }, include: { items: true, pharmacy: true } });
  if (!order || order.pharmacyId !== pharmacyId) throw notFound("Order not found.");
  const rule = NEXT[input.action];
  if (!rule.from.includes(order.status)) throw badRequest(`An order that is ${order.status.toLowerCase()} cannot be moved to “${input.action}”.`);
  if (input.action === "dispatch" && order.fulfilment !== "DELIVERY") throw badRequest("Pickup orders are completed on collection; they are not dispatched.");
  if (input.action === "complete" && order.fulfilment === "DELIVERY" && order.status !== "DISPATCHED") {
    throw badRequest("Dispatch a delivery order before completing it.");
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    // Commit stock when the pharmacy accepts the order.
    if (input.action === "accept") {
      for (const line of order.items) {
        const item = await tx.inventoryItem.findUnique({
          where: { pharmacyId_medicineId: { pharmacyId, medicineId: line.medicineId } },
        });
        if (!item || (await availableQuantity(tx, item)) < line.quantity) {
          throw badRequest("Not enough unreserved stock to accept this order. Update stock first or cancel the order.");
        }
        const quantity = item.quantity - line.quantity;
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity, stockStatus: deriveStockStatus(quantity), lastStockUpdate: now },
        });
      }
    }
    // Return committed stock if an accepted order is cancelled before completion.
    if (input.action === "cancel" && order.status !== "PENDING") {
      for (const line of order.items) {
        const item = await tx.inventoryItem.findUnique({
          where: { pharmacyId_medicineId: { pharmacyId, medicineId: line.medicineId } },
        });
        if (item) {
          const quantity = item.quantity + line.quantity;
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { quantity, stockStatus: deriveStockStatus(quantity), lastStockUpdate: now },
          });
        }
      }
    }
    await tx.order.update({
      where: { id },
      data: {
        status: rule.to,
        completedAt: rule.to === "COMPLETED" ? now : undefined,
        paymentStatus: rule.to === "COMPLETED" ? "PAID" : undefined,
        note: input.action === "cancel" && input.reason ? `Cancelled: ${input.reason}` : undefined,
      },
    });
  });
  await audit(userId, `order.${input.action}`, "Order", id, { pharmacyId, to: rule.to });
  await notify(order.patientId, {
    type: "ORDER_UPDATE",
    title: `Order ${rule.to.toLowerCase()}`,
    message: `Your order from ${order.pharmacy.name} ${MESSAGES[rule.to]}.`,
    link: "/dashboard/orders",
  });
  return db.order.findUnique({ where: { id } });
}

export async function cancelOrderAsPatient(patientId: string, id: string) {
  const order = await db.order.findUnique({ where: { id } });
  if (!order || order.patientId !== patientId) throw notFound("Order not found.");
  if (order.status !== "PENDING") throw forbidden("Only orders the pharmacy hasn't accepted yet can be cancelled. Please contact the pharmacy.");
  const updated = await db.order.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(patientId, "order.cancel", "Order", id);
  await notifyPharmacy(order.pharmacyId, {
    type: "ORDER_UPDATE",
    title: "Order cancelled by patient",
    message: "A patient cancelled a pending order.",
    link: "/pharmacy/orders",
  });
  return updated;
}
