import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePharmacyPage } from "@/lib/auth/guard";
import { medicineLabel } from "@/lib/medicine";
import { ksh } from "@/lib/pricing";
import { sweepExpired } from "@/lib/services/sweep";
import { ApiButton } from "@/components/client/ApiButton";
import { Card, EmptyState, PageTitle, StatusBadge, Table, Td, Th, fmtDateTime } from "@/components/ui";

export const metadata: Metadata = { title: "Reservations" };

export default async function PharmacyReservations() {
  const ctx = await requirePharmacyPage();
  await sweepExpired();
  const [confirmations, reservations] = await Promise.all([
    db.stockConfirmation.findMany({
      where: { pharmacyId: ctx.pharmacyId, status: "PENDING", expiresAt: { gt: new Date() } },
      include: { medicine: true, patient: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.reservation.findMany({
      where: { pharmacyId: ctx.pharmacyId },
      include: { medicine: true, patient: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageTitle title="Reservations & confirmations" subtitle="Check your shelf, then respond. Responding also refreshes your stock timestamp." />

      <section>
        <h2 className="mb-3 font-semibold">Stock & price confirmation requests</h2>
        {confirmations.length === 0 ? (
          <EmptyState>No pending confirmation requests.</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {confirmations.map((c) => (
              <Card key={c.id}>
                <p className="font-medium">{medicineLabel(c.medicine)}</p>
                <p className="text-sm text-slate-600">
                  {c.patient.fullName} wants {c.requestedQuantity} · requested {fmtDateTime(c.createdAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ApiButton url={`/api/stock-confirmations/${c.id}`} body={{ action: "confirm" }} variant="primary">Confirm in stock</ApiButton>
                  <ApiButton url={`/api/stock-confirmations/${c.id}`} body={{ action: "unavailable" }}>Unavailable</ApiButton>
                  <ApiButton url={`/api/stock-confirmations/${c.id}`} body={{ action: "unavailable", markOutOfStock: true }} variant="danger" confirm="Mark unavailable and set this medicine to out of stock?">
                    Unavailable + mark out of stock
                  </ApiButton>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Reservations</h2>
        {reservations.length === 0 ? (
          <EmptyState>No reservations yet.</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Patient</Th><Th>Medicine</Th><Th>Qty</Th><Th>Price</Th><Th>Status</Th><Th>Created</Th><Th>Expires</Th><Th>Action</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.map((r) => (
                <tr key={r.id}>
                  <Td>{r.patient.fullName}<span className="block text-xs text-slate-500">{r.patient.phone}</span></Td>
                  <Td className="font-medium">{medicineLabel(r.medicine)}</Td>
                  <Td>{r.quantity}</Td>
                  <Td>{ksh(r.unitPrice * r.quantity)}<span className="block text-xs text-slate-500">{ksh(r.unitPrice)} each</span></Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td>{fmtDateTime(r.createdAt)}</Td>
                  <Td>{fmtDateTime(r.expiresAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {r.status === "PENDING" && (
                        <>
                          <ApiButton url={`/api/reservations/${r.id}`} body={{ action: "confirm", holdHours: 4 }} variant="primary">Confirm (hold 4h)</ApiButton>
                          <ApiButton url={`/api/reservations/${r.id}`} body={{ action: "reject" }} variant="danger" promptFor={{ label: "Reason for rejecting (shared with the patient, optional):", field: "reason" }}>Reject</ApiButton>
                        </>
                      )}
                      {r.status === "CONFIRMED" && (
                        <>
                          <ApiButton url={`/api/reservations/${r.id}`} body={{ action: "collect" }} variant="primary" confirm="Record that the patient collected this medicine? Stock will be reduced.">Mark collected</ApiButton>
                          <ApiButton url={`/api/reservations/${r.id}`} body={{ action: "expire" }} confirm="Expire this reservation now?">Expire</ApiButton>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
