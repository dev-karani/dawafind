"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "./api";
import { btn, inputClass } from "../ui";

interface Props {
  pharmacyId: string;
  medicineId: string;
  unitPrice: number;
  serviceFee: number;
  deliveryFee: number;
  deliveryAvailable: boolean;
  maxQty: number;
  signedIn: boolean;
  isPatient: boolean;
  nextUrl: string;
  canReserve: boolean;
}

const ksh = (n: number) => `KSh ${n.toLocaleString("en-KE")}`;

export function OfferActions(p: Props) {
  const [panel, setPanel] = useState<null | "reserve" | "delivery">(null);
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string; href?: string } | null>(null);

  if (!p.signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(p.nextUrl)}`} className={btn("secondary", "sm")}>
        Sign in to confirm stock or reserve
      </Link>
    );
  }
  if (!p.isPatient) return <p className="text-xs text-slate-500">Patient accounts can confirm and reserve.</p>;

  const delivering = panel === "delivery";
  const medicine = p.unitPrice * qty;
  const delivery = delivering ? p.deliveryFee : 0;
  const total = medicine + delivery + p.serviceFee;

  async function confirmStock() {
    setBusy(true);
    setMsg(null);
    const res = await api("/api/stock-confirmations", "POST", { pharmacyId: p.pharmacyId, medicineId: p.medicineId, quantity: 1 });
    setBusy(false);
    setMsg(
      res.ok
        ? { tone: "ok", text: "Request sent. The pharmacy will confirm stock and price — you’ll get a notification.", href: "/dashboard/reservations" }
        : { tone: "err", text: res.data.error ?? "Could not send request." },
    );
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res =
      panel === "reserve"
        ? await api("/api/reservations", "POST", { pharmacyId: p.pharmacyId, medicineId: p.medicineId, quantity: qty })
        : await api("/api/orders", "POST", { pharmacyId: p.pharmacyId, medicineId: p.medicineId, quantity: qty, deliveryAddress: address });
    setBusy(false);
    if (res.ok) {
      setPanel(null);
      setMsg({
        tone: "ok",
        text: panel === "reserve" ? "Reservation requested. The pharmacy will confirm shortly." : "Delivery order sent to the pharmacy.",
        href: panel === "reserve" ? "/dashboard/reservations" : "/dashboard/orders",
      });
    } else setMsg({ tone: "err", text: res.data.error ?? "Something went wrong." });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={confirmStock} className={btn("secondary", "sm")}>
          Confirm stock
        </button>
        {p.canReserve && (
          <button type="button" onClick={() => setPanel(panel === "reserve" ? null : "reserve")} className={btn("primary", "sm")} aria-expanded={panel === "reserve"}>
            Reserve
          </button>
        )}
        {p.canReserve && p.deliveryAvailable && (
          <button type="button" onClick={() => setPanel(panel === "delivery" ? null : "delivery")} className={btn("secondary", "sm")} aria-expanded={panel === "delivery"}>
            Order delivery
          </button>
        )}
      </div>

      {panel && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex items-end gap-3">
            <div>
              <label htmlFor={`qty-${p.pharmacyId}`} className="mb-1 block text-xs font-medium text-slate-700">Quantity</label>
              <input
                id={`qty-${p.pharmacyId}`}
                type="number"
                min={1}
                max={Math.max(1, p.maxQty)}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(p.maxQty || 1, Number(e.target.value) || 1)))}
                className={`${inputClass} w-24`}
              />
            </div>
            <p className="pb-2 text-xs text-slate-500">Maximum {p.maxQty} per request</p>
          </div>
          {delivering && (
            <div>
              <label htmlFor={`addr-${p.pharmacyId}`} className="mb-1 block text-xs font-medium text-slate-700">Delivery address</label>
              <input id={`addr-${p.pharmacyId}`} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="Building, street, area" maxLength={300} />
            </div>
          )}
          <dl className="space-y-1">
            <div className="flex justify-between"><dt>Medicine ({qty} × {ksh(p.unitPrice)})</dt><dd>{ksh(medicine)}</dd></div>
            {delivering && <div className="flex justify-between"><dt>Delivery</dt><dd>{ksh(delivery)}</dd></div>}
            <div className="flex justify-between"><dt>DawaFind service fee</dt><dd>{ksh(p.serviceFee)}</dd></div>
            <div className="flex justify-between border-t border-slate-300 pt-1 font-semibold"><dt>Estimated total</dt><dd>{ksh(total)}</dd></div>
          </dl>
          <p className="text-xs text-slate-500">
            The pharmacy confirms the final price. You pay the pharmacy on {delivering ? "delivery" : "collection"}; no online payment is taken in this MVP.
          </p>
          <button type="button" disabled={busy || (delivering && address.trim().length < 5)} onClick={submit} className={btn("primary", "sm")}>
            {busy ? "Sending…" : delivering ? "Send delivery order" : "Request reservation"}
          </button>
        </div>
      )}

      {msg && (
        <p role={msg.tone === "err" ? "alert" : "status"} className={`text-xs ${msg.tone === "err" ? "text-red-700" : "text-emerald-800"}`}>
          {msg.text}{" "}
          {msg.href && (
            <Link href={msg.href} className="underline">
              View status
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
