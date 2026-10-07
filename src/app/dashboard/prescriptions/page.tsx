import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { sweepExpired } from "@/lib/services/sweep";
import { ApiButton } from "@/components/client/ApiButton";
import { Check, JsonForm, SelectField } from "@/components/client/JsonForm";
import { Alert, Card, EmptyState, PageTitle, StatusBadge, fmtDateTime, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Prescriptions" };

export default async function PrescriptionsPage() {
  const user = await requirePage(["PATIENT"]);
  await sweepExpired();
  const [prescriptions, pharmacies] = await Promise.all([
    db.prescription.findMany({
      where: { patientId: user.id, deletedAt: null },
      include: { pharmacy: { select: { name: true } } },
      orderBy: { uploadedAt: "desc" },
    }),
    db.pharmacy.findMany({ where: { verificationStatus: "VERIFIED" }, select: { id: true, name: true, area: true }, orderBy: { name: "asc" } }),
  ]);
  const pharmacyOptions = [{ value: "", label: "Keep private for now" }, ...pharmacies.map((p) => ({ value: p.id, label: `${p.name} — ${p.area}` }))];

  return (
    <div className="space-y-6">
      <PageTitle title="Prescriptions" subtitle="Upload a prescription and share it with a pharmacy of your choice." />
      <Alert tone="blue" title="Your prescription is not our advertising product">
        Files are encrypted, never publicly accessible, and visible only to you and the pharmacy you choose. DawaFind does not read, interpret or change your prescription — a pharmacy professional handles any required review. Files are automatically deleted after the retention period.
      </Alert>

      <Card>
        <h2 className="mb-3 font-semibold">Upload a prescription</h2>
        <JsonForm action="/api/prescriptions" multipart submitLabel="Upload securely" successMessage="Prescription uploaded." reset>
          <div>
            <label htmlFor="file" className="mb-1 block text-sm font-medium">PDF, JPG or PNG (max 5 MB)</label>
            <input id="file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png" className={inputClass} />
          </div>
          <SelectField label="Share with a pharmacy (optional)" name="pharmacyId" options={pharmacyOptions} />
          <Check name="consent" label="I consent to DawaFind storing this prescription securely and sharing it only with the pharmacy I choose." />
        </JsonForm>
      </Card>

      <section>
        <h2 className="mb-3 font-semibold">Your uploads</h2>
        {prescriptions.length === 0 ? (
          <EmptyState>No prescriptions uploaded.</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {prescriptions.map((rx) => (
              <Card key={rx.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">Prescription · {rx.mimeType === "application/pdf" ? "PDF" : "Image"}</p>
                    <p className="text-xs text-slate-500">
                      Uploaded {fmtDateTime(rx.uploadedAt)} · auto-deleted {fmtDateTime(rx.expiresAt)}
                    </p>
                  </div>
                  <StatusBadge status={rx.status} />
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {rx.pharmacy ? `Shared with ${rx.pharmacy.name}` : "Private — not shared with any pharmacy"}
                </p>
                {rx.reviewNote && <p className="mt-1 text-sm text-slate-700">Pharmacy note: {rx.reviewNote}</p>}
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <a className="text-sm text-teal-800 underline" href={`/api/prescriptions/${rx.id}/file`} target="_blank" rel="noopener noreferrer">View</a>
                  <ApiButton url={`/api/prescriptions/${rx.id}`} method="DELETE" variant="danger" confirm="Permanently delete this prescription?">Delete</ApiButton>
                </div>
                {(rx.status === "UPLOADED" || rx.status === "REJECTED") && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <JsonForm
                      action={`/api/prescriptions/${rx.id}`}
                      method="PATCH"
                      submitLabel={rx.pharmacy ? "Share with a different pharmacy" : "Share with pharmacy"}
                      variant="secondary"
                      body={{ action: "share", pharmacyId: "$pharmacyId" }}
                    >
                      <SelectField label="Pharmacy" name="pharmacyId" required options={pharmacyOptions.slice(1)} />
                    </JsonForm>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
