import type { ReactNode } from "react";
import { requirePage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/DashboardShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePage(["PLATFORM_ADMIN"], "/admin");
  const [pending, unread] = await Promise.all([
    db.pharmacy.count({ where: { verificationStatus: "PENDING" } }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return (
    <DashboardShell
      heading="DawaFind admin"
      items={[
        { href: "/admin", label: "Overview" },
        { href: "/admin/pharmacies", label: "Pharmacy verification", badge: pending },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/medicines", label: "Medicines" },
        { href: "/admin/transactions", label: "Transactions" },
        { href: "/admin/reports", label: "Reports" },
        { href: "/admin/audit", label: "Audit log" },
        { href: "/admin/settings", label: "Platform settings" },
        { href: "/admin/notifications", label: "Notifications", badge: unread },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
