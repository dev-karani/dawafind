import type { Metadata } from "next";
import type { PrescriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePharmacyPage } from "@/lib/auth/guard";
import { ApiButton } from "@/components/client/ApiButton";
import { Alert, Card, EmptyState, PageTitle, StatusBadge, fmtDateTime } from "@/components/ui";

export const metadata: Metadata = { title: "Prescriptions" };

const GROUPS: { title: string; status: PrescriptionStatus }[] = [
  { title: "New prescriptions", status: "UPLOADED" },
  { title: "Under review", status: "UNDER_REVIEW" },
  { title: "Approved / verified", status: "VERIFIED_BY_PHARMACY" },
  { title: "Rejected", status: "REJECTED" },
  { title: "Completed", status: "COMPLETED" },
];

export default async function PharmacyPrescriptions() {
  const ctx = await requirePharmacyPage();
  const rx = await db.prescription.findMany({
    where: { pharmacyId: ctx.pharmacyId, deletedAt: null },
    include: { patient: { select: { fullName: true } } },
    orderBy: { uploadedAt: "desc" },
  });
  return (
    <div className="space-y-8">
      <PageTitle title="Prescriptions" subtitle="Only prescriptions patients chose to share with your pharmacy appear here." />
      <Alert tone="blue" title="Handle with care">
        Prescription review must be carried out by a pharmacy professional. Opening a file is recorded in the audit trail. DawaFind never reads, interprets or alters prescriptions, and prescription data must not be used for marketing.
      </Alert>
      {GROUPS.map((g) => {
        const list = rx.filter((r) => r.status === g.status);
        return (
          <section key={g.status}>
            <h2 className="mb-3 font-semibold">{g.title} <span className="text-sm font-normal text-slate-500">({list.length})</span></h2>
            {list.length === 0 ? (
              <EmptyState>None.</EmptyState>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((r) => (
                  <Card key={r.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.patient.fullName}</p>
                        <p className="text-xs text-slate-500">Received {fmtDateTime(r.uploadedAt)} · auto-deleted {fmtDateTime(r.expiresAt)}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.reviewNote && <p className="mt-2 text-sm text-slate-700">Note: {r.reviewNote}</p>}
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <a className="text-sm text-teal-800 underline" href={`/api/prescriptions/${r.id}/file`} target="_blank" rel="noopener noreferrer">Open file</a>
                      {r.status === "UPLOADED" && <ApiButton url={`/api/prescriptions/${r.id}`} body={{ action: "start_review" }} variant="primary">Start review</ApiButton>}
                      {r.status === "UNDER_REVIEW" && (
                        <>
                          <ApiButton url={`/api/prescriptions/${r.id}`} body={{ action: "verify" }} variant="primary" confirm="Confirm that a pharmacy professional has verified this prescription?">Verified</ApiButton>
                          <ApiButton url={`/api/prescriptions/${r.id}`} body={{ action: "reject" }} variant="danger" promptFor={{ label: "Reason (shared with the patient):", field: "note", required: true }}>Reject</ApiButton>
                        </>
                      )}
                      {r.status === "VERIFIED_BY_PHARMACY" && <ApiButton url={`/api/prescriptions/${r.id}`} body={{ action: "complete" }} variant="primary">Mark completed</ApiButton>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
