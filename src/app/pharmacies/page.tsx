import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { openStatus, type OpeningHours } from "@/lib/hours";
import { ksh } from "@/lib/pricing";
import { Badge, Card, EmptyState, btn } from "@/components/ui";

export const metadata: Metadata = { title: "Browse pharmacies" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const PER_AREA = 4;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function PharmaciesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const town = first(raw.town)?.slice(0, 60) || undefined;
  const area = first(raw.area)?.slice(0, 60) || undefined;

  // Only VERIFIED pharmacies are ever listed.
  const all = await db.pharmacy.findMany({
    where: { verificationStatus: "VERIFIED" },
    select: {
      id: true,
      name: true,
      address: true,
      area: true,
      town: true,
      openingHours: true,
      deliveryAvailable: true,
      deliveryFee: true,
      _count: { select: { inventory: { where: { stockStatus: { not: "OUT_OF_STOCK" } } } } },
    },
  });

  const towns = [...new Set(all.map((p) => p.town))].sort((a, b) => a.localeCompare(b));
  const scoped = all.filter((p) => (!town || p.town === town) && (!area || p.area === area));

  // Group by town → area.
  const groups = new Map<string, { town: string; area: string; list: typeof all }>();
  for (const p of scoped) {
    const key = `${p.town}||${p.area}`;
    if (!groups.has(key)) groups.set(key, { town: p.town, area: p.area, list: [] });
    groups.get(key)!.list.push(p);
  }
  const ordered = [...groups.values()].sort((a, b) => a.town.localeCompare(b.town) || a.area.localeCompare(b.area));

  const now = new Date();
  const href = (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/pharmacies?${s}` : "/pharmacies";
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Browse pharmacies</h1>
          <p className="mt-1 text-sm text-slate-600">
            {area ? `All verified pharmacies in ${area}.` : `A random selection of verified pharmacies in each area. No ranking — ${all.length} verified pharmacies in total.`}
          </p>
        </div>
        {!area && (
          // A fresh request re-shuffles the selection.
          <Link href={href({ town })} prefetch={false} className={btn("secondary", "sm")}>↻ Shuffle</Link>
        )}
      </div>

      <nav aria-label="Filter by town" className="mb-6 flex flex-wrap gap-2">
        <Link href="/pharmacies" className={`rounded-full border px-3 py-1 text-sm ${!town && !area ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
          All towns
        </Link>
        {towns.map((t) => (
          <Link key={t} href={href({ town: t })} className={`rounded-full border px-3 py-1 text-sm ${town === t ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {t}
          </Link>
        ))}
      </nav>

      {ordered.length === 0 ? (
        <EmptyState>No verified pharmacies found here yet.</EmptyState>
      ) : (
        <div className="space-y-10">
          {ordered.map((g) => {
            const sample = area ? g.list.sort((a, b) => a.name.localeCompare(b.name)) : shuffle(g.list).slice(0, PER_AREA);
            return (
              <section key={`${g.town}-${g.area}`} aria-labelledby={`a-${g.area.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`a-${g.area.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="text-lg font-semibold">
                    {g.area} <span className="text-sm font-normal text-slate-500">· {g.town}</span>
                  </h2>
                  {!area && g.list.length > sample.length && (
                    <Link href={href({ area: g.area })} className="text-sm text-teal-800 underline">
                      View all {g.list.length} in {g.area} →
                    </Link>
                  )}
                  {!area && g.list.length <= sample.length && (
                    <span className="text-xs text-slate-500">{g.list.length} pharmacies</span>
                  )}
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {sample.map((p) => {
                    const status = openStatus(p.openingHours as OpeningHours, now);
                    return (
                      <li key={p.id}>
                        <Link href={`/pharmacies/${p.id}`} className="block h-full">
                          <Card className="h-full transition-shadow hover:shadow-md">
                            <p className="font-semibold leading-snug">{p.name}</p>
                            <p className="mt-1 text-xs text-slate-600">{p.address}</p>
                            <p className={`mt-2 text-xs ${status.open ? "text-emerald-700" : "text-slate-600"}`}>{status.label}</p>
                            <p className="mt-2 flex flex-wrap items-center gap-1.5">
                              <Badge tone="green">✓ Verified</Badge>
                              <Badge tone="slate">{p._count.inventory} medicines in stock</Badge>
                            </p>
                            <p className="mt-2 text-xs text-slate-600">
                              {p.deliveryAvailable ? `Delivery from ${ksh(p.deliveryFee)}` : "Collection only"}
                            </p>
                            <p className="mt-3 text-sm font-medium text-teal-800">View pharmacy & medicines →</p>
                          </Card>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-10 text-xs text-slate-500">
        Pharmacies are shown in a random order within each area and are not ranked. To compare prices for a specific medicine, use{" "}
        <Link href="/search" className="text-teal-800 underline">Find medicine</Link>.
      </p>
    </div>
  );
}
