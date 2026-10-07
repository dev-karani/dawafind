import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePharmacyPage } from "@/lib/auth/guard";
import { freshness } from "@/lib/freshness";
import { medicineLabel } from "@/lib/medicine";
import { effectivePrice, ksh } from "@/lib/pricing";
import { ApiButton } from "@/components/client/ApiButton";
import { Check, Field, JsonForm, SelectField } from "@/components/client/JsonForm";
import { Alert, Badge, Card, EmptyState, PageTitle, StatusBadge, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Inventory" };

const LEVEL_TONE = { HIGH: "green", MEDIUM: "amber", LOW: "amber", STALE: "red" } as const;

export default async function InventoryPage() {
  const ctx = await requirePharmacyPage();
  const pharmacy = await db.pharmacy.findUniqueOrThrow({ where: { id: ctx.pharmacyId }, select: { verificationStatus: true } });
  const verified = pharmacy.verificationStatus === "VERIFIED";
  const [items, catalogue] = await Promise.all([
    db.inventoryItem.findMany({ where: { pharmacyId: ctx.pharmacyId }, include: { medicine: true }, orderBy: { medicine: { genericName: "asc" } } }),
    db.medicine.findMany({ where: { status: "ACTIVE" }, orderBy: [{ genericName: "asc" }, { strength: "asc" }] }),
  ]);
  const listed = new Set(items.map((i) => i.medicineId));
  const addable = catalogue.filter((m) => !listed.has(m.id));

  return (
    <div className="space-y-6">
      <PageTitle title="Inventory" subtitle="You control your prices, quantities and minimum acceptable price. DawaFind never sets your price below your minimum." />

      {verified ? (
        <Card>
          <h2 className="mb-3 font-semibold">Add a medicine</h2>
          {addable.length === 0 ? (
            <p className="text-sm text-slate-600">Every medicine in the catalogue is already in your inventory. Missing something? Ask a DawaFind administrator to add it to the catalogue.</p>
          ) : (
            <JsonForm action={`/api/pharmacies/${ctx.pharmacyId}/inventory`} submitLabel="Add to inventory" reset className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <SelectField
                  label="Medicine (from the verified catalogue)"
                  name="medicineId"
                  required
                  options={[{ value: "", label: "Choose a medicine…" }, ...addable.map((m) => ({ value: m.id, label: `${medicineLabel(m)} · ${m.packSize}` }))]}
                />
              </div>
              <Field label="Quantity in stock" name="quantity" type="number" min={0} required inputMode="numeric" />
              <Field label="Selling price (KSh)" name="price" type="number" min={1} required inputMode="numeric" />
              <Field label="Minimum acceptable price (KSh)" name="minimumPrice" type="number" min={1} required inputMode="numeric" hint="Promotions can never go below this." />
              <div className="md:col-span-3"><Check name="deliveryAvailable" label="Available for delivery" /></div>
            </JsonForm>
          )}
        </Card>
      ) : (
        <Alert tone="amber">Inventory management unlocks once DawaFind has verified your pharmacy.</Alert>
      )}

      {items.length === 0 ? (
        <EmptyState>No inventory yet.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr><Th>Medicine</Th><Th>Quantity</Th><Th>Price</Th><Th>Min price</Th><Th>Stock status</Th><Th>Last updated</Th><Th>Actions</Th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => {
              const f = freshness(i.lastStockUpdate);
              const live = effectivePrice(i);
              return (
                <tr key={i.id}>
                  <Td className="min-w-48 font-medium">{medicineLabel(i.medicine)}<span className="block text-xs font-normal text-slate-500">{i.medicine.packSize}</span></Td>
                  <Td>{i.quantity}</Td>
                  <Td>
                    {ksh(i.price)}
                    {live !== i.price && <span className="block text-xs text-emerald-700">DawaFind price {ksh(live)}</span>}
                    {i.promoPrice != null && !i.promotionsEnabled && <span className="block text-xs text-slate-500">Promo {ksh(i.promoPrice)} (off)</span>}
                  </Td>
                  <Td>{ksh(i.minimumPrice)}</Td>
                  <Td><StatusBadge status={i.stockStatus} /></Td>
                  <Td>
                    <Badge tone={LEVEL_TONE[f.level]}>{f.level === "STALE" ? "Stale" : f.ago}</Badge>
                    <span className="mt-1 block text-xs text-slate-500">Price updated {freshness(i.lastPriceUpdate).ago}</span>
                  </Td>
                  <Td className="min-w-72">
                    {verified && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-end gap-2">
                          <JsonForm action={`/api/inventory/${i.id}`} method="PATCH" submitLabel="Update stock" variant="secondary" className="flex items-end gap-2" body={{ quantity: "$quantity" }} successMessage="Stock updated.">
                            <div className="w-24"><Field label="Qty" name="quantity" type="number" min={0} defaultValue={i.quantity} required inputMode="numeric" /></div>
                          </JsonForm>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ApiButton url={`/api/inventory/${i.id}`} body={{ refresh: true }}>Still accurate</ApiButton>
                          {i.stockStatus !== "OUT_OF_STOCK" && (
                            <ApiButton url={`/api/inventory/${i.id}`} body={{ markOutOfStock: true }} variant="danger" confirm="Mark this medicine as out of stock?">Mark out of stock</ApiButton>
                          )}
                        </div>
                        <details className="rounded-lg border border-slate-200 p-2">
                          <summary className="cursor-pointer text-sm font-medium text-teal-800">Edit price & options</summary>
                          <JsonForm
                            action={`/api/inventory/${i.id}`}
                            method="PATCH"
                            submitLabel="Save price & options"
                            className="mt-3 space-y-3"
                            successMessage="Saved."
                            body={{
                              price: "$price",
                              minimumPrice: "$minimumPrice",
                              promoPrice: "$promoPrice:null",
                              promotionsEnabled: "$promotionsEnabled:bool",
                              deliveryAvailable: "$deliveryAvailable:bool",
                            }}
                          >
                            <Field label="Selling price (KSh)" name="price" type="number" min={1} defaultValue={i.price} required inputMode="numeric" />
                            <Field label="Minimum acceptable price (KSh)" name="minimumPrice" type="number" min={1} defaultValue={i.minimumPrice} required inputMode="numeric" />
                            <Field label="DawaFind promotion price (optional)" name="promoPrice" type="number" min={1} defaultValue={i.promoPrice} inputMode="numeric" hint="Rejected automatically if below your minimum." />
                            <Check name="promotionsEnabled" label="Show the promotion price to patients" defaultChecked={i.promotionsEnabled} />
                            <Check name="deliveryAvailable" label="Available for delivery" defaultChecked={i.deliveryAvailable} />
                          </JsonForm>
                        </details>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
