import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePharmacyPage } from "@/lib/auth/guard";
import { medicineLabel } from "@/lib/medicine";
import { ksh } from "@/lib/pricing";
import { ApiButton } from "@/components/client/ApiButton";
import { EmptyState, PageTitle, StatusBadge, Table, Td, Th, fmtDateTime, pretty } from "@/components/ui";

export const metadata: Metadata = { title: "Orders" };

export default async function PharmacyOrders() {
  const ctx = await requirePharmacyPage();
  const orders = await db.order.findMany({
    where: { pharmacyId: ctx.pharmacyId },
    include: { items: { include: { medicine: true } }, patient: { select: { fullName: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <PageTitle title="Orders" subtitle="Accept an order to commit stock. Collections made from reservations appear here as completed." />
      {orders.length === 0 ? (
        <EmptyState>No orders yet.</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>Order ID</Th><Th>Patient</Th><Th>Items</Th><Th>Total</Th><Th>Status</Th><Th>Created</Th><Th>Action</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <Td className="font-mono text-xs">{o.id.slice(-8).toUpperCase()}<span className="block font-sans text-slate-500">{pretty(o.fulfilment)}</span></Td>
                <Td>
                  {o.patient.fullName}
                  <span className="block text-xs text-slate-500">{o.patient.phone}</span>
                  {o.deliveryAddress && <span className="block text-xs text-slate-500">📍 {o.deliveryAddress}</span>}
                </Td>
                <Td>{o.items.map((i) => <div key={i.id}>{i.quantity} × {medicineLabel(i.medicine)}</div>)}</Td>
                <Td>{ksh(o.subtotal + o.deliveryFee)}<span className="block text-xs text-slate-500">patient pays {ksh(o.total)}</span></Td>
                <Td><StatusBadge status={o.status} /></Td>
                <Td>{fmtDateTime(o.createdAt)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {o.status === "PENDING" && <ApiButton url={`/api/orders/${o.id}`} body={{ action: "accept" }} variant="primary">Accept</ApiButton>}
                    {o.status === "ACCEPTED" && <ApiButton url={`/api/orders/${o.id}`} body={{ action: "prepare" }} variant="primary">Start preparing</ApiButton>}
                    {o.status === "PREPARING" && o.fulfilment === "DELIVERY" && <ApiButton url={`/api/orders/${o.id}`} body={{ action: "dispatch" }} variant="primary">Dispatch</ApiButton>}
                    {o.status === "PREPARING" && o.fulfilment === "PICKUP" && <ApiButton url={`/api/orders/${o.id}`} body={{ action: "complete" }} variant="primary">Complete</ApiButton>}
                    {o.status === "DISPATCHED" && <ApiButton url={`/api/orders/${o.id}`} body={{ action: "complete" }} variant="primary">Mark delivered</ApiButton>}
                    {["PENDING", "ACCEPTED", "PREPARING", "DISPATCHED"].includes(o.status) && (
                      <ApiButton url={`/api/orders/${o.id}`} body={{ action: "cancel" }} variant="danger" promptFor={{ label: "Reason for cancelling (shared with the patient, optional):", field: "reason" }}>Cancel</ApiButton>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
