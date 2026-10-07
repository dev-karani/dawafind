"use client";

import { useState } from "react";
import { api } from "./api";
import { btn } from "../ui";

export function SavePharmacyButton({ pharmacyId, saved: initial }: { pharmacyId: string; saved: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={saved}
      className={btn("secondary", "sm")}
      onClick={async () => {
        setBusy(true);
        const res = await api("/api/saved-pharmacies", saved ? "DELETE" : "POST", { pharmacyId });
        setBusy(false);
        if (res.ok) setSaved(!saved);
      }}
    >
      {saved ? "★ Saved" : "☆ Save pharmacy"}
    </button>
  );
}
