import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { areaByKey } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth/session";
import { medicineLabel } from "@/lib/medicine";
import { searchQuerySchema } from "@/lib/schemas";
import { compareMedicine, findMedicines } from "@/lib/services/search";
import { OfferCard } from "@/components/OfferCard";
import { SearchForm } from "@/components/client/SearchForm";
import { AlertButton } from "@/components/client/AlertButton";
import { Alert, Badge, Card, EmptyState, btn, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Find a medicine" };

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const PAGE_SIZE = 15;

const SORTS = [
  { v: "total", l: "Lowest estimated total" },
  { v: "price", l: "Lowest medicine price" },
  { v: "distance", l: "Closest pharmacy" },
  { v: "fresh", l: "Most recently updated stock" },
] as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const parsed = searchQuerySchema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v)])));
  const p = parsed.success ? parsed.data : {};
  const user = await getCurrentUser();
  const carry = new URLSearchParams();
  if (p.area) carry.set("area", p.area);
  if (p.lat != null && p.lng != null) {
    carry.set("lat", String(p.lat));
    carry.set("lng", String(p.lng));
  }

  const header = (
    <div className="mb-6">
      <SearchForm q={p.q} area={p.area} lat={p.lat} lng={p.lng} compact />
    </div>
  );

  // ── 1. No medicine selected yet ──
  if (!p.medicineId) {
    if (!p.q) {
      return (
        <div>
          <h1 className="mb-4 text-2xl font-semibold">Find a medicine</h1>
          {header}
          <EmptyState>Type the medicine your prescriber gave you — name, strength and form, e.g. “Amoxicillin 500mg capsules”.</EmptyState>
        </div>
      );
    }
    const matches = await findMedicines(p.q);
    const userId = user?.role === "PATIENT" ? user.id : null;
    if (matches.length === 1) {
      const qs = new URLSearchParams(carry);
      qs.set("medicineId", matches[0].id);
      qs.set("q", p.q);
      redirect(`/search?${qs.toString()}`);
    }
    await db.searchEvent.create({
      data: { userId, query: p.q.slice(0, 120), area: p.area ?? null, resultCount: matches.length, foundVerifiedAvailable: false },
    });
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold">Find a medicine</h1>
        {header}
        {matches.length === 0 ? (
          <EmptyState>
            No medicines in the DawaFind catalogue match “{p.q}”. Check the spelling, or try the generic name.
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">
              {matches.length} matching medicines. Different strengths and forms are different products — choose exactly what was prescribed.
            </p>
            <ul className="space-y-2">
              {matches.map((m) => {
                const qs = new URLSearchParams(carry);
                qs.set("medicineId", m.id);
                qs.set("q", p.q!);
                return (
                  <li key={m.id}>
                    <Link href={`/search?${qs.toString()}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md">
                      <span>
                        <span className="block font-semibold">{medicineLabel(m)}</span>
                        <span className="block text-sm text-slate-600">
                          {m.brandName ? `${m.brandName} · ` : ""}
                          {m.packSize}
                        </span>
                      </span>
                      <span className="text-sm font-medium text-teal-800">Compare pharmacies →</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    );
  }

  // ── 2. Compare pharmacies for a specific medicine ──
  const medicine = await db.medicine.findUnique({ where: { id: p.medicineId } });
  if (!medicine || medicine.status !== "ACTIVE") {
    return (
      <div>
        {header}
        <Alert tone="amber">That medicine is no longer available in the catalogue. Please search again.</Alert>
      </div>
    );
  }
  const mode = p.mode ?? "PICKUP";
  const radius = p.radius ?? 25;
  const result = await compareMedicine({
    medicineId: medicine.id,
    area: p.area,
    lat: p.lat,
    lng: p.lng,
    radiusKm: hasOrigin(p) ? radius : null,
    sort: p.sort,
    fulfilment: mode,
    userId: user?.role === "PATIENT" ? user.id : null,
    query: p.q ?? medicineLabel(medicine),
  });

  const shown = Math.min(500, Math.max(PAGE_SIZE, Number.parseInt(first(raw.show) ?? "", 10) || PAGE_SIZE));
  const showHref = (n: number) => {
    const qs = new URLSearchParams(
      Object.entries(raw).flatMap(([k, v]) => (k === "show" || v == null ? [] : [[k, first(v) as string]])),
    );
    qs.set("show", String(n));
    return `/search?${qs.toString()}`;
  };

  const nextParams = new URLSearchParams(carry);
  nextParams.set("medicineId", medicine.id);
  if (p.q) nextParams.set("q", p.q);
  const nextUrl = `/search?${nextParams.toString()}`;
  const allStale = result.offers.length > 0 && result.offers.every((o) => o.stockFreshness.level === "STALE");
  const areaLabel = result.origin?.label;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">{medicineLabel(medicine)}</h1>
      <p className="mb-4 text-sm text-slate-600">
        {medicine.brandName ? `${medicine.brandName} · ` : ""}
        {medicine.packSize}
        {p.q && (
          <>
            {" · "}
            <Link href={`/search?q=${encodeURIComponent(p.q)}&${carry.toString()}`} className="text-teal-800 underline">Not what you meant?</Link>
          </>
        )}
      </p>
      {header}

      <form method="get" action="/search" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="medicineId" value={medicine.id} />
        {p.q && <input type="hidden" name="q" value={p.q} />}
        {p.area && <input type="hidden" name="area" value={p.area} />}
        {p.lat != null && p.lng != null && (
          <>
            <input type="hidden" name="lat" value={p.lat} />
            <input type="hidden" name="lng" value={p.lng} />
          </>
        )}
        <div>
          <label htmlFor="sort" className="mb-1 block text-xs font-medium text-slate-700">Sort by</label>
          <select id="sort" name="sort" defaultValue={result.sort} className={inputClass}>
            {SORTS.map((s) => (
              <option key={s.v} value={s.v} disabled={s.v === "distance" && !result.origin}>{s.l}{s.v === "distance" && !result.origin ? " (choose an area)" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mode" className="mb-1 block text-xs font-medium text-slate-700">Get it by</label>
          <select id="mode" name="mode" defaultValue={mode} className={inputClass}>
            <option value="PICKUP">Collection (all pharmacies)</option>
            <option value="DELIVERY">Delivery (where offered)</option>
          </select>
        </div>
        {result.origin && (
          <div>
            <label htmlFor="radius" className="mb-1 block text-xs font-medium text-slate-700">Within</label>
            <select id="radius" name="radius" defaultValue={String(radius)} className={inputClass}>
              {[5, 10, 25, 50, 200].map((r) => (
                <option key={r} value={r}>{r === 200 ? "Anywhere" : `${r} km`}</option>
              ))}
            </select>
          </div>
        )}
        <button className={btn("secondary")} type="submit">Apply</button>
      </form>

      <div className="mb-4 space-y-2">
        <p className="text-xs text-slate-600" aria-live="polite">
          Showing {result.offers.length} participating verified pharmacies{areaLabel ? ` near ${areaLabel}` : ""}, sorted by{" "}
          <strong>{SORTS.find((s) => s.v === result.sort)?.l.toLowerCase()}</strong>. DawaFind doesn’t rank a “best” pharmacy — you choose.
        </p>
        <p className="text-xs text-slate-600">
          “Estimated total” = medicine price + delivery (if chosen) + a DawaFind service fee of KSh {result.serviceFee}. The pharmacy confirms the final price.
        </p>
      </div>

      {allStale && (
        <div className="mb-4">
          <Alert tone="amber">Stock information may be outdated. Request confirmation before travelling.</Alert>
        </div>
      )}

      {result.offers.length === 0 ? (
        result.unavailable.length > 0 ? (
          <Card className="mb-6">
            <p className="font-medium">This medicine is currently marked out of stock at participating pharmacies in this area.</p>
            <div className="mt-3">
              <AlertButton medicineId={medicine.id} area={p.area} signedIn={!!user} isPatient={user?.role === "PATIENT"} nextUrl={nextUrl} />
            </div>
          </Card>
        ) : (
          <Card className="mb-6">
            <p className="font-medium">
              No participating pharmacies currently match this search. Try expanding your search area or create an availability alert.
            </p>
            <div className="mt-3">
              <AlertButton medicineId={medicine.id} area={p.area} signedIn={!!user} isPatient={user?.role === "PATIENT"} nextUrl={nextUrl} />
            </div>
          </Card>
        )
      ) : (
        <>
          <div className="space-y-4">
            {result.offers.slice(0, shown).map((o) => (
              <OfferCard key={o.inventoryId} offer={o} medicine={medicine} serviceFee={result.serviceFee} user={user} nextUrl={nextUrl} />
            ))}
          </div>
          {result.offers.length > shown && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-600">
                Showing {shown} of {result.offers.length} pharmacies in the order you chose.
              </p>
              <Link href={showHref(shown + PAGE_SIZE)} className={btn("secondary")}>Show {Math.min(PAGE_SIZE, result.offers.length - shown)} more</Link>
              <Link href={showHref(result.offers.length)} className="text-sm text-teal-800 underline">Show all</Link>
            </div>
          )}
        </>
      )}

      {result.unavailable.length > 0 && (
        <section className="mt-10" aria-labelledby="oos">
          <h2 id="oos" className="mb-3 flex items-center gap-2 text-lg font-semibold">
            Marked out of stock <Badge tone="red">{result.unavailable.length}</Badge>
          </h2>
          {result.offers.length > 0 && (
            <div className="mb-3">
              <AlertButton medicineId={medicine.id} area={p.area} signedIn={!!user} isPatient={user?.role === "PATIENT"} nextUrl={nextUrl} />
            </div>
          )}
          <div className="space-y-3">
            {result.unavailable.slice(0, 10).map((o) => (
              <OfferCard key={o.inventoryId} offer={o} medicine={medicine} serviceFee={result.serviceFee} user={user} nextUrl={nextUrl} muted />
            ))}
            {result.unavailable.length > 10 && (
              <p className="text-sm text-slate-600">…and {result.unavailable.length - 10} more pharmacies currently marked out of stock.</p>
            )}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs text-slate-500">
        DawaFind shows information from participating pharmacies to help you find a prescribed medicine. It does not diagnose, prescribe or recommend replacing your prescribed medicine — speak to your pharmacist or prescriber for advice.
      </p>
    </div>
  );
}

function hasOrigin(p: { area?: string; lat?: number; lng?: number }) {
  return !!areaByKey(p.area) || (p.lat != null && p.lng != null);
}

