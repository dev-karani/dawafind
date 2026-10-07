import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { PageTitle, Table, Td, Th, btn, fmtDateTime, inputClass, pretty } from "@/components/ui";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requirePage(["PLATFORM_ADMIN"]);
  const { action } = await searchParams;
  const logs = await db.auditLog.findMany({
    where: action ? { action: { startsWith: action } } : undefined,
    include: { user: { select: { fullName: true, role: true } } },
    orderBy: { timestamp: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-6">
      <PageTitle title="Audit log" subtitle="Verification, stock and price changes, prescription access, reservation and order changes, suspensions and admin actions. Prescription contents are never logged." />
      <form method="get" className="flex gap-3">
        <input name="action" defaultValue={action} placeholder="Filter by action, e.g. prescription." aria-label="Filter by action" className={`${inputClass} max-w-xs`} />
        <button className={btn("secondary")}>Filter</button>
      </form>
      <Table>
        <thead><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap">{fmtDateTime(l.timestamp)}</Td>
              <Td>{l.user ? `${l.user.fullName} (${pretty(l.user.role)})` : "System"}</Td>
              <Td className="font-mono text-xs">{l.action}</Td>
              <Td className="text-xs">{l.entityType}<span className="block font-mono text-slate-500">{l.entityId?.slice(-8)}</span></Td>
              <Td className="max-w-xs break-words font-mono text-xs text-slate-600">{l.metadata ? JSON.stringify(l.metadata) : ""}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
