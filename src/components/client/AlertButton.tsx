"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "./api";
import { btn } from "../ui";

export function AlertButton({ medicineId, area, signedIn, isPatient, nextUrl }: { medicineId: string; area?: string; signedIn: boolean; isPatient: boolean; nextUrl: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [err, setErr] = useState("");

  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(nextUrl)}`} className={btn("secondary", "sm")}>
        Sign in to be notified when available
      </Link>
    );
  }
  if (!isPatient) return null;
  if (state === "done") {
    return (
      <p role="status" className="text-sm text-emerald-800">
        Alert created. We’ll notify you when a participating pharmacy reports this medicine as available.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={state === "busy"}
        className={btn("primary", "sm")}
        onClick={async () => {
          setState("busy");
          const res = await api("/api/availability-alerts", "POST", { medicineId, area: area || undefined });
          if (res.ok) setState("done");
          else {
            setErr(res.data.error ?? "Could not create alert.");
            setState("err");
          }
        }}
      >
        Notify me when available
      </button>
      {state === "err" && <p role="alert" className="text-xs text-red-700">{err}</p>}
    </div>
  );
}
