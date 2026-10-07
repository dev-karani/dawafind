import type { ReactNode } from "react";
import { requirePage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/DashboardShell";

export default async function PatientLayout({ children }: { children: ReactNode }) {
  const user = await requirePage(["PATIENT"], "/dashboard");
  const unread = await db.notification.count({ where: { userId: user.id, read: false } });
  return (
    <DashboardShell
      heading="My DawaFind"
      items={[
        { href: "/dashboard", label: "Overview" },
        { href: "/dashboard/reservations", label: "Reservations" },
        { href: "/dashboard/orders", label: "Orders" },
        { href: "/dashboard/saved", label: "Saved pharmacies" },
        { href: "/dashboard/alerts", label: "Availability alerts" },
        { href: "/dashboard/prescriptions", label: "Prescriptions" },
        { href: "/dashboard/notifications", label: "Notifications", badge: unread },
        { href: "/dashboard/settings", label: "Privacy & settings" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
