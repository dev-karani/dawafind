import type { ReactNode } from "react";
import { requirePharmacyPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/DashboardShell";
import { Alert, StatusBadge } from "@/components/ui";

export default async function PharmacyLayout({ children }: { children: ReactNode }) {
  const ctx = await requirePharmacyPage();
  const [pharmacy, pendingRes, pendingConf, openOrders, newRx, unread] = await Promise.all([
    db.pharmacy.findUniqueOrThrow({ where: { id: ctx.pharmacyId }, select: { name: true, verificationStatus: true, verificationNote: true } }),
    db.reservation.count({ where: { pharmacyId: ctx.pharmacyId, status: "PENDING" } }),
    db.stockConfirmation.count({ where: { pharmacyId: ctx.pharmacyId, status: "PENDING", expiresAt: { gt: new Date() } } }),
    db.order.count({ where: { pharmacyId: ctx.pharmacyId, status: "PENDING" } }),
    db.prescription.count({ where: { pharmacyId: ctx.pharmacyId, status: "UPLOADED", deletedAt: null } }),
    db.notification.count({ where: { userId: ctx.user.id, read: false } }),
  ]);
  const admin = ctx.staffRole === "PHARMACY_ADMIN";
  const items = [
    { href: "/pharmacy", label: "Overview" },
    { href: "/pharmacy/inventory", label: "Inventory" },
    { href: "/pharmacy/reservations", label: "Reservations", badge: pendingRes + pendingConf },
    { href: "/pharmacy/orders", label: "Orders", badge: openOrders },
    { href: "/pharmacy/prescriptions", label: "Prescriptions", badge: newRx },
    { href: "/pharmacy/analytics", label: "Analytics" },
    ...(admin ? [{ href: "/pharmacy/settings", label: "Settings & staff" }] : []),
    { href: "/pharmacy/notifications", label: "Notifications", badge: unread },
  ];
  return (
    <DashboardShell heading={pharmacy.name} items={items}>
      {pharmacy.verificationStatus !== "VERIFIED" && (
        <div className="mb-6">
          <Alert tone={pharmacy.verificationStatus === "PENDING" ? "amber" : "red"} title="Your pharmacy is not visible to patients">
            <p className="flex items-center gap-2">
              Status: <StatusBadge status={pharmacy.verificationStatus} />
            </p>
            <p className="mt-1">
              {pharmacy.verificationStatus === "PENDING"
                ? "A DawaFind administrator is reviewing your licence details. You’ll be notified once you’re verified; inventory management unlocks after verification."
                : `Contact DawaFind support to resolve this.${pharmacy.verificationNote ? ` Reason: ${pharmacy.verificationNote}` : ""}`}
            </p>
          </Alert>
        </div>
      )}
      {children}
    </DashboardShell>
  );
}
