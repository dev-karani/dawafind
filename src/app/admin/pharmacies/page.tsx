import type { Metadata } from "next";
import Link from "next/link";
import type { VerificationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { ApiButton } from "@/components/client/ApiButton";
import { Card, EmptyState, PageTitle, StatusBadge, fmtDateTime } from "@/components/ui";

export const metadata: Metadata = { title: "Pharmacy verification" };

const TABS: (VerificationStatus | "ALL")[] = ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED", "ALL"];

export default async function AdminPharmacies({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePage(["PLATFORM_ADMIN"]);
  const { status } = await searchParams;
  const filter = TABS.includes(status as never) ? (status as VerificationStatus | "ALL") : "PENDING";
  const pharmacies = await db.pharmacy.findMany({
    where: filter === "ALL" ? {} : { verificationStatus: filter },
    include: { staff: { where: { role: "PHARMACY_ADMIN" }, include: { user: { select: { fullName: true, email: true, phone: true } } } }, _count: { select: { inventory: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <PageTitle title="Pharmacy verification" subtitle="Only verified pharmacies are shown to patients. Check the licence reference and responsible pharmacist before verifying." />
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <Link key={t} href={`/admin/pharmacies?status=${t}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter === t ? "bg-teal-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>
      {pharmacies.length === 0 ? (
        <EmptyState>No pharmacies in this view.</EmptyState>
      ) : (
        <div className="space-y-4">
          {pharmacies.map((p) => {
            const owner = p.staff[0]?.user;
            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    <p className="text-sm text-slate-600">{p.address} · {p.area}, {p.town}</p>
                  </div>
                  <StatusBadge status={p.verificationStatus} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="text-xs uppercase text-slate-500">Licence reference</dt><dd className="font-mono">{p.licenseReference}</dd></div>
                  <div><dt className="text-xs uppercase text-slate-500">Responsible pharmacist</dt><dd>{p.responsiblePharmacist}</dd></div>
                  <div><dt className="text-xs uppercase text-slate-500">Contact</dt><dd>{p.phone} · {p.email}</dd></div>
                  <div><dt className="text-xs uppercase text-slate-500">Applicant</dt><dd>{owner ? `${owner.fullName} (${owner.email})` : "—"}</dd></div>
                  <div><dt className="text-xs uppercase text-slate-500">Coordinates</dt><dd>{p.latitude}, {p.longitude}</dd></div>
                  <div><dt className="text-xs uppercase text-slate-500">Submitted</dt><dd>{fmtDateTime(p.createdAt)}{p.verifiedAt ? ` · verified ${fmtDateTime(p.verifiedAt)}` : ""}</dd></div>
                </dl>
                {p.businessInfo && <p className="mt-3 text-sm text-slate-700"><span className="text-xs uppercase text-slate-500">Business info: </span>{p.businessInfo}</p>}
                {p.verificationNote && <p className="mt-2 text-sm text-slate-700"><span className="text-xs uppercase text-slate-500">Last note: </span>{p.verificationNote}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(p.verificationStatus === "PENDING" || p.verificationStatus === "REJECTED") && (
                    <ApiButton url={`/api/admin/pharmacies/${p.id}/verify`} body={{ action: "verify" }} variant="primary" confirm={`Verify ${p.name}? It will appear as a Verified Pharmacy to patients.`}>Verify</ApiButton>
                  )}
                  {(p.verificationStatus === "PENDING" || p.verificationStatus === "VERIFIED") && (
                    <ApiButton url={`/api/admin/pharmacies/${p.id}/verify`} body={{ action: "reject" }} variant="danger" promptFor={{ label: "Reason for rejection (shared with the pharmacy):", field: "note", required: true }}>Reject</ApiButton>
                  )}
                  {p.verificationStatus === "VERIFIED" && (
                    <ApiButton url={`/api/admin/pharmacies/${p.id}/verify`} body={{ action: "suspend" }} variant="danger" promptFor={{ label: "Reason for suspension (shared with the pharmacy):", field: "note", required: true }}>Suspend</ApiButton>
                  )}
                  {p.verificationStatus === "SUSPENDED" && (
                    <ApiButton url={`/api/admin/pharmacies/${p.id}/verify`} body={{ action: "reinstate" }} variant="primary">Reinstate</ApiButton>
                  )}
                  <span className="self-center text-xs text-slate-500">{p._count.inventory} inventory listings</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
