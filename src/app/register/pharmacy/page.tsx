import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guard";
import { Alert, Card } from "@/components/ui";
import { Field, JsonForm, TextAreaField } from "@/components/client/JsonForm";
import { AREAS } from "@/lib/areas";

export const metadata: Metadata = { title: "Register your pharmacy" };

export default async function RegisterPharmacyPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Register your pharmacy</h1>
      <p className="mb-4 text-sm text-slate-600">
        Reach patients searching for medicines while keeping control of your prices, stock and minimum acceptable margins.
      </p>
      <div className="mb-6">
        <Alert title="Verification required">
          A DawaFind administrator reviews your licence and responsible-pharmacist details before your pharmacy is shown as a <strong>Verified Pharmacy</strong>. Until then you can sign in, but you will not appear to patients.
        </Alert>
      </div>
      <Card>
        <JsonForm
          action="/api/auth/register"
          submitLabel="Submit for verification"
          body={{
            type: "pharmacy",
            fullName: "$fullName",
            email: "$email",
            phone: "$phone",
            password: "$password",
            pharmacy: {
              name: "$pharmacyName",
              address: "$address",
              area: "$area",
              town: "$town",
              latitude: "$latitude",
              longitude: "$longitude",
              phone: "$pharmacyPhone",
              email: "$pharmacyEmail",
              licenseReference: "$licenseReference",
              responsiblePharmacist: "$responsiblePharmacist",
              businessInfo: "$businessInfo",
            },
          }}
        >
          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-semibold text-slate-900">Your account (pharmacy administrator)</legend>
            <Field label="Your full name" name="fullName" required autoComplete="name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your email" name="email" type="email" required autoComplete="email" />
              <Field label="Your phone" name="phone" type="tel" required autoComplete="tel" />
            </div>
            <Field label="Password" name="password" type="password" required autoComplete="new-password" hint="At least 8 characters, with a letter and a number." />
          </fieldset>

          <fieldset className="space-y-4 border-t border-slate-200 pt-4">
            <legend className="mb-2 text-sm font-semibold text-slate-900">Pharmacy details</legend>
            <Field label="Pharmacy name" name="pharmacyName" required />
            <Field label="Physical address" name="address" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Neighbourhood / area" name="area" required placeholder="e.g. Westlands" />
              <Field label="Town" name="town" required placeholder="e.g. Nairobi" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" name="latitude" required inputMode="decimal" placeholder="-1.2676" hint="Used for distance. Right-click your location in a map app to copy it." />
              <Field label="Longitude" name="longitude" required inputMode="decimal" placeholder="36.8108" />
            </div>
            <p className="text-xs text-slate-500">
              Examples: {AREAS.slice(0, 3).map((a) => `${a.label} (${a.lat}, ${a.lng})`).join(" · ")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pharmacy phone" name="pharmacyPhone" type="tel" required />
              <Field label="Pharmacy email" name="pharmacyEmail" type="email" required />
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-slate-200 pt-4">
            <legend className="mb-2 text-sm font-semibold text-slate-900">Licensing & responsible pharmacist</legend>
            <Field label="Premises licence / registration reference" name="licenseReference" required hint="Current Pharmacy and Poisons Board premises licence or registration number." />
            <Field label="Responsible pharmacist / pharmacy professional" name="responsiblePharmacist" required />
            <TextAreaField label="Business information (optional)" name="businessInfo" placeholder="Business registration, branch details, anything that helps verification." />
          </fieldset>
        </JsonForm>
      </Card>
      <p className="mt-4 text-sm">
        Looking for medicine instead? <Link href="/register" className="text-teal-800 underline">Create a patient account</Link>.
      </p>
    </div>
  );
}
