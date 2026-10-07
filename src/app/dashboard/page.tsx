import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { medicineLabel } from "@/lib/medicine";
import { sweepExpired } from "@/lib/services/sweep";
import { SearchForm } from "@/components/client/SearchForm";
import { Card, PageTitle, Stat, StatusBadge, fmtDateTime } from "@/components/ui";

export const metadata: Metadata = { title: "My dashboard" };

export default async function PatientHome() {
  const user = await requirePage(["PATIENT"], "/dashboard");
  await sweepExpired();
  const profile = await db.patientProfile.findUnique({ where: { userId: user.id } });
  const [recent, activeRes, orders, alerts, pending] = await Promise.all([
    db.searchEvent.findMany({
      where: { userId: user.id, medicineId: { not: null } },
      include: { medicine: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.reservation.findMany({
      where: { patientId: user.id, status: { in: ["PENDING", "CONFIRMED"] } },
      include: { medicine: true, pharmacy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.order.count({ where: { patientId: user.id, status: { in: ["PENDING", "ACCEPTED", "PREPARING", "DISPATCHED"] } } }),
    db.availabilityAlert.count({ where: { patientId: user.id, status: "ACTIVE" } }),
    db.stockConfirmation.count({ where: { patientId: user.id, status: "PENDING" } }),
  ]);
  // De-duplicate recent searches by medicine.
  const seen = new Set<string>();
  const recents = recent.filter((r) => r.medicine && !seen.has(r.medicineId!) && seen.add(r.medicineId!)).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageTitle title={`Hello, ${user.fullName.split(" ")[0]}`} subtitle="Search for a medicine and compare verified pharmacies." />
      <Card>
        <SearchForm area={profile?.defaultArea ?? ""} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active reservations" value={activeRes.length} href="/dashboard/reservations" />
        <Stat label="Awaiting stock confirmation" value={pending} href="/dashboard/reservations" />
        <Stat label="Open orders" value={orders} href="/dashboard/orders" />
        <Stat label="Availability alerts" value={alerts} href="/dashboard/alerts" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Recent searches</h2>
          {recents.length === 0 ? (
            <p className="text-sm text-slate-600">Your recent medicine searches will appear here. They’re private to you and never used for advertising.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recents.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <Link className="font-medium text-teal-800 hover:underline" href={`/search?medicineId=${r.medicineId}${r.area ? `&area=${r.area}` : ""}`}>
                    {medicineLabel(r.medicine!)}
                  </Link>
                  <span className="text-xs text-slate-500">{fmtDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Active reservations</h2>
          {activeRes.length === 0 ? (
            <p className="text-sm text-slate-600">No active reservations.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {activeRes.map((r) => (
                <li key={r.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.quantity} × {medicineLabel(r.medicine)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-slate-500">{r.pharmacy.name} · {r.status === "CONFIRMED" ? "held until" : "request expires"} {fmtDateTime(r.expiresAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
