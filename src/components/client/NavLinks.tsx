"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Section" className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((i) => {
        const root = items[0].href;
        const active = i.href === root ? path === i.href : path === i.href || path.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {i.label}
            {!!i.badge && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? "bg-white text-teal-800" : "bg-teal-700 text-white"}`}>
                {i.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
