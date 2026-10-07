import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { areaByKey } from "@/lib/areas";
import { medicineLabel } from "@/lib/medicine";
import { ApiButton } from "@/components/client/ApiButton";
import { EmptyState, PageTitle, StatusBadge, Table, Td, Th, fmtDateTime } from "@/components/ui";

export const metadata: Metadata = { title: "Availability alerts" };

export default async function AlertsPage() {
  const user = await requirePage(["PATIENT"]);
  const alerts = await db.availabilityAlert.findMany({
    where: { patientId: user.id, status: { not: "CANCELLED" } },
    include: { medicine: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <PageTitle title="Availability alerts" subtitle="We notify you when a participating pharmacy reports a medicine as available again." />
      {alerts.length === 0 ? (
        <EmptyState>No alerts. When a medicine is out of stock, choose “Notify me when available”.</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>Medicine</Th><Th>Area</Th><Th>Status</Th><Th>Created</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <tr key={a.id}>
                <Td className="font-medium">{medicineLabel(a.medicine)}</Td>
                <Td>{areaByKey(a.area)?.label ?? "Anywhere"}</Td>
                <Td><StatusBadge status={a.status} /></Td>
                <Td>{fmtDateTime(a.createdAt)}</Td>
                <Td className="space-x-2 whitespace-nowrap">
                  {a.status === "NOTIFIED" && (
                    <Link className="text-teal-800 underline" href={`/search?medicineId=${a.medicineId}${a.area ? `&area=${a.area}` : ""}`}>Compare</Link>
                  )}
                  <ApiButton url={`/api/availability-alerts/${a.id}`} method="DELETE" variant="danger">Remove</ApiButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
