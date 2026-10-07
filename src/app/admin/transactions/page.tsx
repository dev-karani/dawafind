import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { medicineLabel } from "@/lib/medicine";
import { ksh } from "@/lib/pricing";
import { PageTitle, StatusBadge, Table, Td, Th, fmtDateTime, pretty } from "@/components/ui";

export const metadata: Metadata = { title: "Transactions" };

export default async function AdminTransactions() {
  await requirePage(["PLATFORM_ADMIN"]);
  const [orders, reservations] = await Promise.all([
    db.order.findMany({
      include: { items: { include: { medicine: true } }, pharmacy: { select: { name: true } }, patient: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.reservation.findMany({
      include: { medicine: true, pharmacy: { select: { name: true } }, patient: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return (
    <div className="space-y-8">
      <PageTitle title="Transactions" subtitle="Online payments are not part of the MVP; fees are recorded for later settlement." />
      <section>
        <h2 className="mb-3 font-semibold">Orders</h2>
        <Table>
          <thead><tr><Th>Order</Th><Th>Pharmacy</Th><Th>Patient</Th><Th>Items</Th><Th>Total</Th><Th>DawaFind fee</Th><Th>Status</Th><Th>Refund</Th><Th>Date</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <Td className="font-mono text-xs">{o.id.slice(-8).toUpperCase()}<span className="block font-sans text-slate-500">{pretty(o.fulfilment)}</span></Td>
                <Td>{o.pharmacy.name}</Td>
                <Td>{o.patient.fullName}</Td>
                <Td>{o.items.map((i) => <div key={i.id}>{i.quantity} × {medicineLabel(i.medicine)}</div>)}</Td>
                <Td>{ksh(o.total)}</Td>
                <Td>{ksh(o.serviceFee)}</Td>
                <Td><StatusBadge status={o.status} /></Td>
                <Td><StatusBadge status={o.refundStatus} /></Td>
                <Td>{fmtDateTime(o.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Reservations</h2>
        <Table>
          <thead><tr><Th>Pharmacy</Th><Th>Patient</Th><Th>Medicine</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th><Th>Date</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {reservations.map((r) => (
              <tr key={r.id}>
                <Td>{r.pharmacy.name}</Td>
                <Td>{r.patient.fullName}</Td>
                <Td>{medicineLabel(r.medicine)}</Td>
                <Td>{r.quantity}</Td>
                <Td>{ksh(r.totalPrice)}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td>{fmtDateTime(r.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
