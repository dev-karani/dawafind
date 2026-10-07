import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { medicineLabel } from "@/lib/medicine";
import { ksh } from "@/lib/pricing";
import { ApiButton } from "@/components/client/ApiButton";
import { EmptyState, PageTitle, StatusBadge, Table, Td, Th, fmtDateTime, pretty } from "@/components/ui";

export const metadata: Metadata = { title: "Orders" };

export default async function PatientOrders() {
  const user = await requirePage(["PATIENT"]);
  const orders = await db.order.findMany({
    where: { patientId: user.id },
    include: { items: { include: { medicine: true } }, pharmacy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div>
      <PageTitle title="Orders" subtitle="Collections and deliveries. You pay the pharmacy directly in this MVP." />
      {orders.length === 0 ? (
        <EmptyState>No orders yet.</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>Order</Th><Th>Pharmacy</Th><Th>Items</Th><Th>Breakdown</Th><Th>Status</Th><Th>Date</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <Td className="font-mono text-xs">{o.id.slice(-8).toUpperCase()}<span className="block font-sans text-slate-500">{pretty(o.fulfilment)}</span></Td>
                <Td><Link className="text-teal-800 hover:underline" href={`/pharmacies/${o.pharmacy.id}`}>{o.pharmacy.name}</Link></Td>
                <Td>{o.items.map((i) => <div key={i.id}>{i.quantity} × {medicineLabel(i.medicine)}</div>)}</Td>
                <Td className="text-xs">
                  Medicine {ksh(o.subtotal)}
                  {o.deliveryFee > 0 && <> · Delivery {ksh(o.deliveryFee)}</>} · Service fee {ksh(o.serviceFee)}
                  <span className="block text-sm font-semibold text-slate-900">Total {ksh(o.total)}</span>
                </Td>
                <Td><StatusBadge status={o.status} /></Td>
                <Td>{fmtDateTime(o.createdAt)}</Td>
                <Td>
                  {o.status === "PENDING" && (
                    <ApiButton url={`/api/orders/${o.id}`} body={{ action: "cancel" }} variant="danger" confirm="Cancel this order?">Cancel</ApiButton>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
