"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { btn, inputClass } from "../ui";
import { DAYS, DAY_LABEL, type OpeningHours } from "@/lib/hours";

export function HoursForm({ initial }: { initial: OpeningHours }) {
  const router = useRouter();
  const [hours, setHours] = useState<OpeningHours>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await api("/api/pharmacy/settings", "PATCH", { openingHours: hours });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Opening hours saved." } : { ok: false, text: res.data.error ?? "Could not save." });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-3">
      {DAYS.map((d) => {
        const h = hours[d];
        return (
          <div key={d} className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-sm font-medium">{DAY_LABEL[d]}</span>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={!h}
                onChange={(e) => setHours({ ...hours, [d]: e.target.checked ? null : { open: "08:00", close: "20:00" } })}
              />
              Closed
            </label>
            {h && (
              <>
                <input aria-label={`${DAY_LABEL[d]} opens`} type="time" value={h.open} onChange={(e) => setHours({ ...hours, [d]: { ...h, open: e.target.value } })} className={`${inputClass} w-32`} />
                <span>to</span>
                <input aria-label={`${DAY_LABEL[d]} closes`} type="time" value={h.close} onChange={(e) => setHours({ ...hours, [d]: { ...h, close: e.target.value } })} className={`${inputClass} w-32`} />
              </>
            )}
          </div>
        );
      })}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-800" : "text-red-700"}`}>{msg.text}</p>}
      <button type="button" onClick={save} disabled={busy} className={btn("primary")}>{busy ? "Saving…" : "Save opening hours"}</button>
    </div>
  );
}
