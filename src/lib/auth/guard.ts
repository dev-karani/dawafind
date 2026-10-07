import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "../db";
import { forbidden, unauthorized } from "../http";
import { getCurrentUser, type SessionUser } from "./session";

export const homeFor = (role: Role) =>
  role === "PATIENT" ? "/dashboard" : role === "PLATFORM_ADMIN" ? "/admin" : "/pharmacy";

/** Page guard: redirects to login, or to the user's own home when the role does not match. */
export async function requirePage(roles?: Role[], nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

/** API guard: throws 401 / 403 ApiErrors (handled by `route`). */
export async function requireApi(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (roles && !roles.includes(user.role)) throw forbidden();
  return user;
}

export interface PharmacyContext {
  user: SessionUser;
  pharmacyId: string;
  staffRole: "PHARMACY_STAFF" | "PHARMACY_ADMIN";
}

/** Resolve the pharmacy the signed-in staff member belongs to. Staff only ever see their own pharmacy. */
export async function getPharmacyContext(user: SessionUser): Promise<PharmacyContext | null> {
  if (user.role !== "PHARMACY_STAFF" && user.role !== "PHARMACY_ADMIN") return null;
  const m = await db.pharmacyStaff.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!m) return null;
  return { user, pharmacyId: m.pharmacyId, staffRole: m.role };
}

export async function requirePharmacyPage(opts?: { adminOnly?: boolean }): Promise<PharmacyContext> {
  const user = await requirePage(opts?.adminOnly ? ["PHARMACY_ADMIN"] : ["PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  const ctx = await getPharmacyContext(user);
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requirePharmacyApi(opts?: { adminOnly?: boolean }): Promise<PharmacyContext> {
  const user = await requireApi(opts?.adminOnly ? ["PHARMACY_ADMIN"] : ["PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  const ctx = await getPharmacyContext(user);
  if (!ctx) throw forbidden("Your account is not linked to an active pharmacy.");
  return ctx;
}
