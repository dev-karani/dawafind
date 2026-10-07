import type { Metadata } from "next";
import { requirePharmacyPage } from "@/lib/auth/guard";
import { ksh } from "@/lib/pricing";
import { pharmacyOverview } from "@/lib/services/analytics";
import { sweepExpired } from "@/lib/services/sweep";
import { Alert, PageTitle, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Pharmacy overview" };

export default async function PharmacyOverview() {
  const ctx = await requirePharmacyPage();
  await sweepExpired();
  const o = await pharmacyOverview(ctx.pharmacyId);
  const alerts = o.inventoryAlerts;
  return (
    <div className="space-y-6">
      <PageTitle title="Overview" subtitle="DawaFind is your customer acquisition and inventory visibility tool." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Today’s searches" value={o.searchesToday} hint="Times your pharmacy appeared in results" />
        <Stat label="Pending reservations" value={o.pendingReservations} href="/pharmacy/reservations" />
        <Stat label="Pending confirmations" value={o.pendingConfirmations} href="/pharmacy/reservations" hint="Stock & price checks" />
        <Stat label="Open orders" value={o.openOrders} href="/pharmacy/orders" />
        <Stat label="Inventory alerts" value={alerts.outOfStock + alerts.limited + alerts.stale} href="/pharmacy/inventory" hint={`${alerts.outOfStock} out · ${alerts.limited} limited · ${alerts.stale} stale`} />
        <Stat label="Revenue (30 days)" value={ksh(o.revenue30d)} hint="Completed orders, excluding DawaFind fee" href="/pharmacy/analytics" />
      </div>
      {alerts.stale > 0 && (
        <Alert tone="amber" title="Some stock information is more than 24 hours old">
          Patients see old listings as “may be outdated”. Open Inventory and use “Still accurate” or update quantities to keep your listings trusted.
        </Alert>
      )}
    </div>
  );
}
