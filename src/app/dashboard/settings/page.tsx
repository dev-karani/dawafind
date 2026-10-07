import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { AREAS } from "@/lib/areas";
import { Check, Field, JsonForm, SelectField } from "@/components/client/JsonForm";
import { Alert, Card, PageTitle, fmtDateTime } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy & settings" };

export default async function PatientSettings() {
  const user = await requirePage(["PATIENT"]);
  const profile = await db.patientProfile.findUnique({ where: { userId: user.id } });
  return (
    <div className="space-y-6">
      <PageTitle title="Privacy & settings" />

      <Card>
        <h2 className="mb-3 font-semibold">Profile</h2>
        <JsonForm
          action="/api/me"
          method="PATCH"
          submitLabel="Save profile"
          successMessage="Profile saved."
          body={{ fullName: "$fullName", phone: "$phone:null", defaultArea: "$defaultArea:null", emailNotifications: "$emailNotifications:bool" }}
        >
          <Field label="Full name" name="fullName" defaultValue={user.fullName} required />
          <Field label="Phone" name="phone" type="tel" defaultValue={user.phone} />
          <SelectField
            label="Default search area"
            name="defaultArea"
            defaultValue={profile?.defaultArea ?? ""}
            options={[{ value: "", label: "None" }, ...AREAS.map((a) => ({ value: a.key, label: a.label }))]}
          />
          <Check name="emailNotifications" label="Email me about reservations, orders and alerts" defaultChecked={profile?.emailNotifications ?? true} hint="Emails never include prescription details." />
        </JsonForm>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Change password</h2>
        <JsonForm action="/api/auth/password" method="PATCH" submitLabel="Change password" successMessage="Password changed. Other devices were signed out." reset
          body={{ currentPassword: "$currentPassword", newPassword: "$newPassword" }}>
          <Field label="Current password" name="currentPassword" type="password" required autoComplete="current-password" />
          <Field label="New password" name="newPassword" type="password" required autoComplete="new-password" />
        </JsonForm>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Your health data</h2>
        <p className="text-sm text-slate-600">
          {profile?.healthDataConsentAt ? `You gave consent to store prescriptions on ${fmtDateTime(profile.healthDataConsentAt)}.` : "You haven’t given consent to store prescriptions."}{" "}
          DawaFind does not sell prescription information or use it for advertising.
        </p>
        <div className="mt-4 space-y-4">
          <JsonForm action="/api/me/privacy" submitLabel="Withdraw consent & delete all prescriptions" variant="danger" successMessage="Consent withdrawn and prescriptions securely deleted." body={{ action: "withdraw_consent" }}>
            <p className="text-sm text-slate-700">Withdrawing consent permanently and securely deletes every prescription you uploaded.</p>
          </JsonForm>
          <hr />
          <Alert tone="amber" title="Delete account">
            This removes your personal details, alerts, saved pharmacies, search history and prescriptions. Records pharmacies must keep for completed orders are retained without your identity.
          </Alert>
          <JsonForm action="/api/me/privacy" submitLabel="Delete my account" variant="danger" body={{ action: "delete_account", password: "$password" }}>
            <Field label="Confirm your password" name="password" type="password" required autoComplete="current-password" />
          </JsonForm>
        </div>
      </Card>
    </div>
  );
}
