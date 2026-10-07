import type { Metadata } from "next";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { ApiButton } from "@/components/client/ApiButton";
import { PageTitle, StatusBadge, Table, Td, Th, fmtDateTime, inputClass, pretty, btn } from "@/components/ui";

export const metadata: Metadata = { title: "Users" };

const ROLES: Role[] = ["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN", "PLATFORM_ADMIN"];

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const me = await requirePage(["PLATFORM_ADMIN"]);
  const { q, role } = await searchParams;
  const users = await db.user.findMany({
    where: {
      status: { not: "DELETED" },
      role: ROLES.includes(role as Role) ? (role as Role) : undefined,
      OR: q ? [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] : undefined,
    },
    select: { id: true, fullName: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-6">
      <PageTitle title="Users" />
      <form className="flex flex-wrap gap-3" method="get">
        <input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search users" className={`${inputClass} max-w-xs`} />
        <select name="role" defaultValue={role ?? ""} aria-label="Role" className={`${inputClass} max-w-48`}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{pretty(r)}</option>)}
        </select>
        <button className={btn("secondary")}>Filter</button>
      </form>
      <Table>
        <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Joined</Th><Th /></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id}>
              <Td className="font-medium">{u.fullName}</Td>
              <Td>{u.email}</Td>
              <Td>{pretty(u.role)}</Td>
              <Td><StatusBadge status={u.status} /></Td>
              <Td>{fmtDateTime(u.createdAt)}</Td>
              <Td>
                {u.role !== "PLATFORM_ADMIN" && u.id !== me.id && (
                  u.status === "ACTIVE" ? (
                    <ApiButton url={`/api/admin/users/${u.id}`} body={{ action: "suspend" }} variant="danger" promptFor={{ label: "Reason for suspension (audit log):", field: "reason" }}>Suspend</ApiButton>
                  ) : (
                    <ApiButton url={`/api/admin/users/${u.id}`} body={{ action: "reactivate" }}>Reactivate</ApiButton>
                  )
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
