import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { medicineLabel } from "@/lib/medicine";
import { ApiButton } from "@/components/client/ApiButton";
import { Field, JsonForm } from "@/components/client/JsonForm";
import { Card, PageTitle, StatusBadge, Table, Td, Th, btn, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Medicines" };

export default async function AdminMedicines({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePage(["PLATFORM_ADMIN"]);
  const { q } = await searchParams;
  const medicines = await db.medicine.findMany({
    where: q ? { OR: [{ genericName: { contains: q, mode: "insensitive" } }, { brandName: { contains: q, mode: "insensitive" } }] } : undefined,
    include: { _count: { select: { inventory: true } } },
    orderBy: [{ genericName: "asc" }, { strength: "asc" }],
    take: 300,
  });
  return (
    <div className="space-y-6">
      <PageTitle title="Medicine catalogue" subtitle="Pharmacies can only list medicines that exist here. Different strengths and forms are separate entries." />
      <Card>
        <h2 className="mb-3 font-semibold">Add a medicine</h2>
        <JsonForm action="/api/admin/medicines" submitLabel="Add medicine" successMessage="Medicine added." reset className="grid gap-4 md:grid-cols-3">
          <Field label="Generic name" name="genericName" required placeholder="Amoxicillin" />
          <Field label="Brand name (optional)" name="brandName" />
          <Field label="Strength" name="strength" required placeholder="500mg" />
          <Field label="Dosage form" name="dosageForm" required placeholder="Capsules" />
          <Field label="Pack size" name="packSize" required placeholder="Pack of 20" />
          <Field label="Description (optional)" name="description" />
        </JsonForm>
      </Card>
      <form method="get" className="flex gap-3">
        <input name="q" defaultValue={q} placeholder="Search generic or brand name" aria-label="Search medicines" className={`${inputClass} max-w-xs`} />
        <button className={btn("secondary")}>Search</button>
      </form>
      <Table>
        <thead><tr><Th>Medicine</Th><Th>Brand</Th><Th>Pack</Th><Th>Listings</Th><Th>Status</Th><Th /></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {medicines.map((m) => (
            <tr key={m.id}>
              <Td className="font-medium">{medicineLabel(m)}</Td>
              <Td>{m.brandName ?? "—"}</Td>
              <Td>{m.packSize}</Td>
              <Td>{m._count.inventory}</Td>
              <Td><StatusBadge status={m.status} /></Td>
              <Td>
                <ApiButton url={`/api/admin/medicines/${m.id}`} body={{ status: m.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }} variant={m.status === "ACTIVE" ? "danger" : "secondary"}>
                  {m.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                </ApiButton>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
