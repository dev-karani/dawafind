import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { openStatus } from "@/lib/hours";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { SavePharmacyButton } from "@/components/client/SavePharmacyButton";

export const metadata: Metadata = { title: "Saved pharmacies" };

export default async function SavedPharmacies() {
  const user = await requirePage(["PATIENT"]);
  const saved = await db.savedPharmacy.findMany({
    where: { patientId: user.id, pharmacy: { verificationStatus: "VERIFIED" } },
    include: { pharmacy: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <PageTitle title="Saved pharmacies" />
      {saved.length === 0 ? (
        <EmptyState>Save pharmacies from their profile page for quick access.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {saved.map(({ pharmacy: p }) => (
            <Card key={p.id}>
              <Link href={`/pharmacies/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>
              <p className="mt-1"><Badge tone="green">✓ Verified Pharmacy</Badge></p>
              <p className="mt-2 text-sm text-slate-600">{p.address}</p>
              <p className="text-sm text-slate-600">{openStatus(p.openingHours).label}</p>
              <div className="mt-3"><SavePharmacyButton pharmacyId={p.id} saved /></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
