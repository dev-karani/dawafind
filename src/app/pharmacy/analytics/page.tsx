import type { Metadata } from "next";
import { requirePharmacyPage } from "@/lib/auth/guard";
import { ksh } from "@/lib/pricing";
import { pharmacyAnalytics } from "@/lib/services/analytics";
import { Card, PageTitle, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Analytics" };

export default async function PharmacyAnalyticsPage() {
  const ctx = await requirePharmacyPage();
  const a = await pharmacyAnalytics(ctx.pharmacyId, 30);
  return (
    <div className="space-y-6">
      <PageTitle title="Analytics" subtitle={`Last ${a.days} days — how DawaFind brings customers to your pharmacy.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Medicine searches" value={a.searches.toLocaleString()} hint="Times you appeared in results" />
        <Stat label="Pharmacy profile views" value={a.views.toLocaleString()} />
        <Stat label="Reservations" value={a.reservations.toLocaleString()} hint={`${a.collected} collected`} />
        <Stat label="Completed orders" value={a.completedOrders.toLocaleString()} />
        <Stat label="Revenue via DawaFind" value={ksh(a.revenue)} hint="Excludes DawaFind service fee" />
        <Stat label="Conversion rate" value={`${(a.conversionRate * 100).toFixed(1)}%`} hint="Reservations + orders ÷ search appearances" />
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Popular medicines (by search appearances)</h2>
        {a.popular.length === 0 ? (
          <p className="text-sm text-slate-600">No data yet.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {a.popular.map((p, i) => (
              <li key={p.medicine} className="flex items-center justify-between">
                <span>{i + 1}. {p.medicine}</span>
                <span className="font-medium">{p.appearances}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
