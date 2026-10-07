import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { LogoutButton } from "./client/LogoutButton";
import { btn } from "./ui";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, read: false } }) : 0;
  const notifHref = user?.role === "PATIENT" ? "/dashboard/notifications" : user?.role === "PLATFORM_ADMIN" ? "/admin/notifications" : "/pharmacy/notifications";
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-teal-800">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-white">+</span>
          DawaFind
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link href="/search" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Find medicine
          </Link>
          <Link href="/pharmacies" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Pharmacies
          </Link>
          {user ? (
            <>
              <Link href={homeFor(user.role)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                {user.role === "PATIENT" ? "My dashboard" : user.role === "PLATFORM_ADMIN" ? "Admin" : "Pharmacy"}
              </Link>
              <Link href={notifHref} className="relative rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
                Alerts
                {unread > 0 && (
                  <span className="ml-1 rounded-full bg-teal-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">{unread}</span>
                )}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Sign in
              </Link>
              <Link href="/register" className={btn("primary", "sm")}>
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
