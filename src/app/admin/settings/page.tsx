import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { getSettings } from "@/lib/services/settings";
import { ApiButton } from "@/components/client/ApiButton";
import { Field, JsonForm } from "@/components/client/JsonForm";
import { Card, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Platform settings" };

export default async function AdminSettings() {
  await requirePage(["PLATFORM_ADMIN"]);
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <PageTitle title="Platform settings" />
      <Card>
        <h2 className="mb-1 font-semibold">Fees & retention</h2>
        <p className="mb-4 text-sm text-slate-600">The service fee is always shown to patients before they confirm. No hidden fees.</p>
        <JsonForm
          action="/api/admin/settings"
          method="PATCH"
          submitLabel="Save settings"
          successMessage="Settings saved."
          className="grid gap-4 md:grid-cols-2"
          body={{
            serviceFee: "$serviceFee",
            stockConfirmationTtlMins: "$stockConfirmationTtlMins",
            pendingReservationTtlMins: "$pendingReservationTtlMins",
            prescriptionRetentionDays: "$prescriptionRetentionDays",
          }}
        >
          <Field label="Service fee per transaction (KSh)" name="serviceFee" type="number" min={0} defaultValue={s.serviceFee} required />
          <Field label="Prescription retention (days)" name="prescriptionRetentionDays" type="number" min={1} defaultValue={s.prescriptionRetentionDays} required hint="Applies to new uploads." />
          <Field label="Stock confirmation validity (minutes)" name="stockConfirmationTtlMins" type="number" min={10} defaultValue={s.stockConfirmationTtlMins} required />
          <Field label="Unanswered reservation expiry (minutes)" name="pendingReservationTtlMins" type="number" min={10} defaultValue={s.pendingReservationTtlMins} required />
        </JsonForm>
      </Card>
      <Card>
        <h2 className="mb-1 font-semibold">Housekeeping</h2>
        <p className="mb-3 text-sm text-slate-600">Expires overdue reservations and confirmations, and securely deletes prescriptions past retention. Also available to schedulers at <code>POST /api/cron/sweep</code>.</p>
        <ApiButton url="/api/admin/sweep" method="POST" variant="secondary">Run housekeeping now</ApiButton>
      </Card>
    </div>
  );
}
