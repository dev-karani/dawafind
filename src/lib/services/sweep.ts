import { db } from "../db";
import { secureDelete } from "../storage";
import { audit } from "../audit";
import { notify } from "../notify";

/**
 * Lazy + scheduled housekeeping:
 *  - expires stale reservations and stock confirmations
 *  - expires prescriptions past retention and securely deletes their files
 * Call from dashboards (cheap) and from the protected /api/cron/sweep endpoint.
 */
export async function sweepExpired() {
  const now = new Date();

  const reservations = await db.reservation.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, expiresAt: { lt: now } },
    include: { medicine: true, pharmacy: { select: { name: true } } },
  });
  for (const r of reservations) {
    await db.reservation.update({ where: { id: r.id }, data: { status: "EXPIRED" } });
    await notify(r.patientId, {
      type: "SYSTEM",
      title: "Reservation expired",
      message: `Your reservation for ${r.medicine.genericName} ${r.medicine.strength} at ${r.pharmacy.name} has expired.`,
      link: "/dashboard/reservations",
    });
  }

  const confirmations = await db.stockConfirmation.updateMany({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });

  const expiredRx = await db.prescription.findMany({
    where: { deletedAt: null, expiresAt: { lt: now } },
    select: { id: true, fileReference: true },
  });
  for (const rx of expiredRx) {
    await secureDelete(rx.fileReference);
    await db.prescription.update({ where: { id: rx.id }, data: { status: "EXPIRED", deletedAt: now } });
    await audit(null, "prescription.retention_delete", "Prescription", rx.id);
  }

  return {
    reservationsExpired: reservations.length,
    confirmationsExpired: confirmations.count,
    prescriptionsDeleted: expiredRx.length,
  };
}
