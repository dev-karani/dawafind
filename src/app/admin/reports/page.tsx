import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { ksh } from "@/lib/pricing";
import { platformReports } from "@/lib/services/analytics";
import { Card, PageTitle, Stat, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminReports() {
  await requirePage(["PLATFORM_ADMIN"]);
  const r = await platformReports(30);
  const f = r.stockFreshness;
  return (
    <div className="space-y-8">
      <PageTitle title="Reports" subtitle={`Last ${r.days} days`} />

      <section>
        <h2 className="mb-3 font-semibold">Search success</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Medicine searches" value={r.searchSuccess.searches} />
          <Stat label="Found a verified available option" value={r.searchSuccess.successful} />
          <Stat label="Success rate" value={`${(r.searchSuccess.rate * 100).toFixed(1)}%`} hint="Primary MVP metric" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Revenue</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Completed orders" value={r.revenue.completedOrders} />
          <Stat label="Transaction value" value={ksh(r.revenue.transactionValue)} />
          <Stat label="Service fees" value={ksh(r.revenue.serviceFees)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Stock freshness</h2>
        <div className="grid gap-4 sm:grid-cols-5">
          <Stat label="High (≤1h)" value={f.high} />
          <Stat label="Medium (1–6h)" value={f.medium} />
          <Stat label="Low (6–24h)" value={f.low} />
          <Stat label="Stale (>24h)" value={f.stale} />
          <Stat label="Average stock age" value={`${f.avgAgeHours.toFixed(1)} h`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Medicine demand</h2>
        <Card>
          {r.medicineDemand.length === 0 ? (
            <p className="text-sm text-slate-600">No searches yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {r.medicineDemand.map((d, i) => (
                <li key={d.medicine} className="flex justify-between"><span>{i + 1}. {d.medicine}</span><span className="font-medium">{d.searches}</span></li>
              ))}
            </ol>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Pharmacy activity</h2>
        <Table>
          <thead><tr><Th>Pharmacy</Th><Th>Area</Th><Th>Listings</Th><Th>Search appearances</Th><Th>Reservations</Th><Th>Orders</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {r.pharmacyActivity.map((p) => (
              <tr key={p.name}>
                <Td className="font-medium">{p.name}</Td><Td>{p.area}</Td><Td>{p.listings}</Td><Td>{p.appearances}</Td><Td>{p.reservations}</Td><Td>{p.orders}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
