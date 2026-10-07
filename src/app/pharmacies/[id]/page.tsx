import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { DAYS, DAY_LABEL, formatDayHours, openStatus, type OpeningHours } from "@/lib/hours";
import { directionsUrl } from "@/lib/geo";
import { effectivePrice, ksh } from "@/lib/pricing";
import { freshness } from "@/lib/freshness";
import { medicineLabel } from "@/lib/medicine";
import { Badge, Card, btn, inputClass } from "@/components/ui";
import { MapEmbed } from "@/components/client/MapEmbed";
import { SavePharmacyButton } from "@/components/client/SavePharmacyButton";

export const metadata: Metadata = { title: "Pharmacy" };

export default async function PharmacyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (rawQ ?? "").trim().slice(0, 60).toLowerCase();
  const pharmacy = await db.pharmacy.findUnique({
    where: { id },
    include: {
      inventory: { where: { stockStatus: { not: "OUT_OF_STOCK" } }, include: { medicine: true }, orderBy: { medicine: { genericName: "asc" } } },
    },
  });
  // Only verified pharmacies have a public page.
  if (!pharmacy || pharmacy.verificationStatus !== "VERIFIED") notFound();

  const user = await getCurrentUser();
  await db.pharmacyImpression.create({ data: { pharmacyId: id, kind: "PROFILE_VIEW" } });
  const saved =
    user?.role === "PATIENT" ? !!(await db.savedPharmacy.findUnique({ where: { patientId_pharmacyId: { patientId: user.id, pharmacyId: id } } })) : false;

  const hours = pharmacy.openingHours as OpeningHours;
  const status = openStatus(hours);

  const visible = q
    ? pharmacy.inventory.filter((i) => `${i.medicine.genericName} ${i.medicine.brandName ?? ""} ${medicineLabel(i.medicine)}`.toLowerCase().includes(q))
    : pharmacy.inventory;
  const limitedCount = pharmacy.inventory.filter((i) => i.stockStatus === "LIMITED").length;
  const prices = pharmacy.inventory.map((i) => effectivePrice(i));

  return (
    <div className="space-y-6">
      <Link href={`/pharmacies?area=${encodeURIComponent(pharmacy.area)}`} className="inline-block text-sm text-teal-800 underline">
        ← All pharmacies in {pharmacy.area}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{pharmacy.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="green">✓ Verified Pharmacy</Badge>
            <span className={status.open ? "text-emerald-700" : "text-slate-600"}>{status.label}</span>
          </p>
        </div>
        {user?.role === "PATIENT" && <SavePharmacyButton pharmacyId={id} saved={saved} />}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Contact & location</h2>
          <p className="text-sm">{pharmacy.address}</p>
          <p className="text-sm text-slate-600">{pharmacy.area}, {pharmacy.town}</p>
          <p className="mt-2 text-sm"><a className="text-teal-800 underline" href={`tel:${pharmacy.phone}`}>{pharmacy.phone}</a></p>
          <p className="text-sm"><a className="text-teal-800 underline" href={`mailto:${pharmacy.email}`}>{pharmacy.email}</a></p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={directionsUrl(pharmacy.latitude, pharmacy.longitude)} target="_blank" rel="noopener noreferrer" className={btn("primary", "sm")}>
              Get directions
            </a>
            <MapEmbed lat={pharmacy.latitude} lng={pharmacy.longitude} name={pharmacy.name} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Directions open in your maps app. The map loads from OpenStreetMap only if you choose to show it.</p>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Opening hours</h2>
          <dl className="space-y-1 text-sm">
            {DAYS.map((d) => (
              <div key={d} className="flex justify-between">
                <dt className="text-slate-600">{DAY_LABEL[d]}</dt>
                <dd>{formatDayHours(hours[d])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm">
            {pharmacy.deliveryAvailable
              ? `Delivery available · ${ksh(pharmacy.deliveryFee)}${pharmacy.deliveryEtaMinutes ? ` · about ${pharmacy.deliveryEtaMinutes} min` : ""}`
              : "Collection only"}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Medicines in stock", String(pharmacy.inventory.length)],
          ["Limited stock", String(limitedCount)],
          ["Lowest price", prices.length ? ksh(Math.min(...prices)) : "—"],
          ["Highest price", prices.length ? ksh(Math.max(...prices)) : "—"],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Medicines listed by this pharmacy</h2>
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="q" className="sr-only">Search this pharmacy’s medicines</label>
            <input id="q" name="q" defaultValue={rawQ ?? ""} maxLength={60} placeholder="Search medicines here…" className={inputClass} />
            <button className={btn("secondary", "sm")} type="submit">Search</button>
            {q && <Link href={`/pharmacies/${id}`} className="text-sm text-teal-800 underline">Clear</Link>}
          </form>
        </div>
        {pharmacy.inventory.length === 0 ? (
          <p className="text-sm text-slate-600">This pharmacy hasn’t listed any available medicines yet.</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-600">No medicines here match “{rawQ}”. Try the generic name, or <Link className="text-teal-800 underline" href={`/search?q=${encodeURIComponent(rawQ ?? "")}`}>compare it across pharmacies</Link>.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Medicine</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((i) => {
                  const f = freshness(i.lastStockUpdate);
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-3 font-medium">{medicineLabel(i.medicine)}</td>
                      <td className="px-4 py-3">
                        {ksh(effectivePrice(i))}
                        <span className="block text-xs text-slate-500">Updated {freshness(i.lastPriceUpdate).ago}</span>
                      </td>
                      <td className="px-4 py-3">
                        {f.level === "STALE" ? "Last reported available" : i.stockStatus === "LIMITED" ? "Limited" : "In stock"}
                        <span className="block text-xs text-slate-500">
                          {f.level === "STALE" ? `Stock information is ${f.ago.replace(" ago", "")} old` : `Updated ${f.ago}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link className="text-teal-800 underline" href={`/search?medicineId=${i.medicineId}`}>Compare</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
