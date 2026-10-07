import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { ksh } from "@/lib/pricing";
import { platformOverview } from "@/lib/services/analytics";
import { PageTitle, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverview() {
  await requirePage(["PLATFORM_ADMIN"]);
  const o = await platformOverview();
  return (
    <div>
      <PageTitle title="Platform overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Total users" value={o.users} href="/admin/users" />
        <Stat label="Patients" value={o.patients} />
        <Stat label="Pharmacies" value={o.pharmacies} href="/admin/pharmacies" />
        <Stat label="Verified pharmacies" value={o.verified} href="/admin/pharmacies?status=VERIFIED" />
        <Stat label="Pending verification" value={o.pending} href="/admin/pharmacies?status=PENDING" />
        <Stat label="Medicine listings" value={o.listings} />
        <Stat label="Reservations" value={o.reservations} href="/admin/transactions" />
        <Stat label="Orders" value={o.orders} href="/admin/transactions" />
        <Stat label="Service-fee revenue" value={ksh(o.serviceFeeRevenue)} hint={`On ${ksh(o.transactionValue)} of completed transactions`} />
        <Stat label="Subscription revenue (monthly)" value={ksh(o.subscriptionRevenueMonthly)} hint="Active plans (manually billed)" />
      </div>
    </div>
  );
}
