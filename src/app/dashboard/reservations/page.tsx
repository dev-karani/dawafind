import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { medicineLabel } from "@/lib/medicine";
import { ksh } from "@/lib/pricing";
import { sweepExpired } from "@/lib/services/sweep";
import { ApiButton } from "@/components/client/ApiButton";
import { Card, EmptyState, PageTitle, StatusBadge, Table, Td, Th, fmtDateTime } from "@/components/ui";

export const metadata: Metadata = { title: "Reservations" };

export default async function PatientReservations() {
  const user = await requirePage(["PATIENT"]);
  await sweepExpired();
  const [reservations, confirmations] = await Promise.all([
    db.reservation.findMany({
      where: { patientId: user.id },
      include: { medicine: true, pharmacy: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.stockConfirmation.findMany({
      where: { patientId: user.id },
      include: { medicine: true, pharmacy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageTitle title="Reservations & stock confirmations" subtitle="Track requests you’ve sent to pharmacies." />

      <section>
        <h2 className="mb-3 font-semibold">Reservations</h2>
        {reservations.length === 0 ? (
          <EmptyState action={<Link href="/search" className="text-teal-800 underline">Find a medicine</Link>}>You haven’t reserved anything yet.</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Medicine</Th><Th>Pharmacy</Th><Th>Qty</Th><Th>Estimated total</Th><Th>Status</Th><Th>Expires</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">{medicineLabel(r.medicine)}</Td>
                  <Td>
                    <Link className="text-teal-800 hover:underline" href={`/pharmacies/${r.pharmacy.id}`}>{r.pharmacy.name}</Link>
                    <span className="block text-xs text-slate-500">{r.pharmacy.phone}</span>
                  </Td>
                  <Td>{r.quantity}</Td>
                  <Td>
                    {ksh(r.totalPrice)}
                    <span className="block text-xs text-slate-500">{ksh(r.unitPrice)} each + {ksh(r.serviceFee)} fee</span>
                  </Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td>{fmtDateTime(r.expiresAt)}</Td>
                  <Td>
                    {(r.status === "PENDING" || r.status === "CONFIRMED") && (
                      <ApiButton url={`/api/reservations/${r.id}`} body={{ action: "cancel" }} variant="danger" confirm="Cancel this reservation?">Cancel</ApiButton>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Stock confirmation requests</h2>
        {confirmations.length === 0 ? (
          <EmptyState>No confirmation requests yet. Use “Confirm stock” on a pharmacy result before you travel.</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {confirmations.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{medicineLabel(c.medicine)}</p>
                    <p className="text-sm text-slate-600">{c.pharmacy.name}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                {c.status === "CONFIRMED" && (
                  <p className="mt-2 text-sm">
                    Confirmed{c.confirmedPrice ? ` at ${ksh(c.confirmedPrice)}` : ""} · valid until {fmtDateTime(c.expiresAt)}
                  </p>
                )}
                {c.status === "PENDING" && <p className="mt-2 text-sm text-slate-600">Waiting for the pharmacy · request expires {fmtDateTime(c.expiresAt)}</p>}
                {c.response && <p className="mt-1 text-sm text-slate-700">“{c.response}”</p>}
                {(c.status === "CONFIRMED" || c.status === "UNAVAILABLE") && (
                  <Link href={`/search?medicineId=${c.medicineId}`} className="mt-2 inline-block text-sm text-teal-800 underline">
                    {c.status === "CONFIRMED" ? "Reserve now" : "Compare other pharmacies"}
                  </Link>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
