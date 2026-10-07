import Link from "next/link";
import type { Medicine } from "@prisma/client";
import type { Offer } from "@/lib/services/search";
import { formatKm } from "@/lib/geo";
import { ksh } from "@/lib/pricing";
import type { Confidence } from "@/lib/freshness";
import { medicineLabel } from "@/lib/medicine";
import { Badge } from "./ui";
import { OfferActions } from "./client/OfferActions";

const DOT: Record<Confidence, { color: string; label: string }> = {
  HIGH: { color: "bg-emerald-500", label: "High confidence" },
  MEDIUM: { color: "bg-amber-400", label: "Medium confidence" },
  LOW: { color: "bg-orange-500", label: "Low confidence" },
  STALE: { color: "bg-red-500", label: "Stale — may be outdated" },
};

export function OfferCard({
  offer,
  medicine,
  serviceFee,
  user,
  nextUrl,
  muted,
}: {
  offer: Offer;
  medicine: Medicine;
  serviceFee: number;
  user: { role: string } | null;
  nextUrl: string;
  muted?: boolean;
}) {
  const { pharmacy: ph, stockFreshness: f } = offer;
  const dot = DOT[f.level];
  const out = offer.stockStatus === "OUT_OF_STOCK";
  const stale = f.level === "STALE";

  let stockHeadline: string;
  if (out) stockHeadline = "Out of stock";
  else if (stale) stockHeadline = `Last reported: ${offer.stockStatus === "LIMITED" ? "limited stock" : "in stock"}`;
  else stockHeadline = offer.stockStatus === "LIMITED" ? "Limited stock" : "In stock";

  return (
    <article className={`rounded-xl border bg-white p-5 shadow-sm ${muted ? "border-slate-200 opacity-90" : "border-slate-200"}`} aria-label={`${ph.name} offer`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">
            <Link href={`/pharmacies/${ph.id}`} className="hover:underline">{ph.name}</Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="green">✓ Verified Pharmacy</Badge>
            <span className={ph.open.open === true ? "text-emerald-700" : "text-slate-600"}>{ph.open.label}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{ksh(offer.unitPrice)}</p>
          {offer.onPromotion && <p className="text-xs text-slate-500">Usual price <s>{ksh(offer.normalPrice)}</s> · DawaFind price</p>}
          <p className="text-xs text-slate-500">Price updated {offer.priceUpdated}</p>
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-700">{medicineLabel(medicine)} · {medicine.packSize}</p>

      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot.color}`} aria-hidden />
            {stockHeadline}
          </p>
          <p className="text-xs text-slate-600">{dot.label}</p>
          <p className="text-xs text-slate-600">{offer.stockSentence}</p>
        </div>
        <div>
          <p className="font-medium">📍 {offer.distanceKm != null ? formatKm(offer.distanceKm) : "Distance unavailable"}</p>
          <p className="text-xs text-slate-600">{ph.area}, {ph.town}</p>
          <p className="text-xs text-slate-600">{ph.phone}</p>
        </div>
        <div>
          <p className="font-medium">
            {offer.delivery.available ? `Delivery: ${ksh(offer.delivery.fee)}` : "Pickup only"}
          </p>
          {offer.delivery.available && offer.delivery.etaMinutes && (
            <p className="text-xs text-slate-600">About {offer.delivery.etaMinutes} min</p>
          )}
        </div>
      </div>

      {!out && stale && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This pharmacy has not updated its stock recently. Stock information may be outdated — request confirmation before travelling.
        </p>
      )}
      {!out && !stale && f.level === "LOW" && (
        <p className="mt-3 text-xs text-amber-800">Stock information may be outdated. Request confirmation before travelling.</p>
      )}

      {!out && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated total</p>
            <dl className="space-y-0.5">
              <div className="flex justify-between"><dt>Medicine</dt><dd>{ksh(offer.pickup.medicine)}</dd></div>
              <div className="flex justify-between"><dt>DawaFind service fee</dt><dd>{ksh(offer.pickup.service)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold"><dt>Pickup total</dt><dd>{ksh(offer.pickup.total)}</dd></div>
              {offer.deliveryCost && (
                <>
                  <div className="flex justify-between pt-1 text-slate-700"><dt>+ Delivery</dt><dd>{ksh(offer.deliveryCost.delivery)}</dd></div>
                  <div className="flex justify-between font-semibold"><dt>Delivery total</dt><dd>{ksh(offer.deliveryCost.total)}</dd></div>
                </>
              )}
            </dl>
          </div>
          <div className="flex items-center">
            <OfferActions
              pharmacyId={ph.id}
              medicineId={medicine.id}
              unitPrice={offer.unitPrice}
              serviceFee={serviceFee}
              deliveryFee={offer.delivery.fee}
              deliveryAvailable={offer.delivery.available}
              maxQty={Math.min(offer.availableQuantity, 10)}
              signedIn={!!user}
              isPatient={user?.role === "PATIENT"}
              nextUrl={nextUrl}
              canReserve={offer.availableQuantity > 0}
            />
          </div>
        </div>
      )}
    </article>
  );
}
