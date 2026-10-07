import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePharmacyPage } from "@/lib/auth/guard";
import type { OpeningHours } from "@/lib/hours";
import { PLANS } from "@/lib/services/accounts";
import { ksh } from "@/lib/pricing";
import { ApiButton } from "@/components/client/ApiButton";
import { HoursForm } from "@/components/client/HoursForm";
import { Check, Field, JsonForm, SelectField } from "@/components/client/JsonForm";
import { Badge, Card, PageTitle, StatusBadge, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Settings & staff" };

export default async function PharmacySettings() {
  const ctx = await requirePharmacyPage({ adminOnly: true });
  const [pharmacy, staff, plan] = await Promise.all([
    db.pharmacy.findUniqueOrThrow({ where: { id: ctx.pharmacyId } }),
    db.pharmacyStaff.findMany({
      where: { pharmacyId: ctx.pharmacyId, status: "ACTIVE" },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.pharmacyPlan.findFirst({ where: { pharmacyId: ctx.pharmacyId, status: "ACTIVE" }, orderBy: { startDate: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle title="Settings & staff" />

      <Card>
        <h2 className="mb-1 font-semibold">Verification</h2>
        <p className="flex items-center gap-2 text-sm">
          <StatusBadge status={pharmacy.verificationStatus} /> Licence reference: <span className="font-mono">{pharmacy.licenseReference}</span>
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Contact & location</h2>
        <JsonForm
          action="/api/pharmacy/settings"
          method="PATCH"
          submitLabel="Save"
          successMessage="Saved."
          className="grid gap-4 md:grid-cols-2"
          body={{
            address: "$address",
            area: "$area",
            town: "$town",
            latitude: "$latitude",
            longitude: "$longitude",
            phone: "$phone",
            email: "$email",
          }}
        >
          <div className="md:col-span-2"><Field label="Physical address" name="address" defaultValue={pharmacy.address} required /></div>
          <Field label="Area" name="area" defaultValue={pharmacy.area} required />
          <Field label="Town" name="town" defaultValue={pharmacy.town} required />
          <Field label="Latitude" name="latitude" defaultValue={pharmacy.latitude} required inputMode="decimal" />
          <Field label="Longitude" name="longitude" defaultValue={pharmacy.longitude} required inputMode="decimal" />
          <Field label="Phone" name="phone" type="tel" defaultValue={pharmacy.phone} required />
          <Field label="Email" name="email" type="email" defaultValue={pharmacy.email} required />
        </JsonForm>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Delivery</h2>
        <JsonForm
          action="/api/pharmacy/settings"
          method="PATCH"
          submitLabel="Save delivery settings"
          successMessage="Saved."
          body={{ deliveryAvailable: "$deliveryAvailable:bool", deliveryFee: "$deliveryFee", deliveryEtaMinutes: "$deliveryEtaMinutes:null" }}
        >
          <Check name="deliveryAvailable" label="We offer delivery" defaultChecked={pharmacy.deliveryAvailable} hint="You also choose delivery per medicine in Inventory." />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Delivery fee (KSh)" name="deliveryFee" type="number" min={0} defaultValue={pharmacy.deliveryFee} inputMode="numeric" />
            <Field label="Estimated delivery time (minutes)" name="deliveryEtaMinutes" type="number" min={5} defaultValue={pharmacy.deliveryEtaMinutes} inputMode="numeric" />
          </div>
        </JsonForm>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Opening hours</h2>
        <HoursForm initial={pharmacy.openingHours as OpeningHours} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Staff</h2>
        <Table>
          <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((s) => (
              <tr key={s.id}>
                <Td>{s.user.fullName}</Td>
                <Td>{s.user.email}</Td>
                <Td><Badge tone={s.role === "PHARMACY_ADMIN" ? "teal" : "slate"}>{s.role === "PHARMACY_ADMIN" ? "Administrator" : "Staff"}</Badge></Td>
                <Td>
                  {s.userId !== ctx.user.id && (
                    <ApiButton url={`/api/pharmacy/staff/${s.id}`} body={{ action: "remove" }} variant="danger" confirm={`Remove ${s.user.fullName}?`}>Remove</ApiButton>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <h3 className="mb-2 mt-5 text-sm font-semibold">Invite a colleague</h3>
        <JsonForm action="/api/pharmacy/staff" submitLabel="Send invitation" successMessage="Invitation sent." reset className="grid gap-4 md:grid-cols-3">
          <Field label="Full name" name="fullName" required />
          <Field label="Email" name="email" type="email" required />
          <SelectField label="Role" name="role" defaultValue="PHARMACY_STAFF" options={[{ value: "PHARMACY_STAFF", label: "Staff" }, { value: "PHARMACY_ADMIN", label: "Administrator" }]} />
        </JsonForm>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Plan</h2>
        <p className="mb-3 text-sm text-slate-600">
          Current plan: <strong>{plan?.planName ?? "BASIC"}</strong> ({ksh(plan?.monthlyFee ?? 0)}/month). In this MVP billing is handled manually and no feature is blocked by payment.
        </p>
        <JsonForm action="/api/pharmacy/plan" method="PATCH" submitLabel="Change plan" successMessage="Plan updated." className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Plan"
            name="planName"
            defaultValue={plan?.planName ?? "BASIC"}
            options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: `${k} — ${ksh(v.monthlyFee)}/mo · ${v.features}` }))}
          />
        </JsonForm>
      </Card>
    </div>
  );
}
