import type { ReactNode } from "react";
import { NavLinks } from "./client/NavLinks";

export function DashboardShell({
  heading,
  items,
  children,
}: {
  heading: string;
  items: { href: string; label: string; badge?: number }[];
  children: ReactNode;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</p>
        <NavLinks items={items} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
