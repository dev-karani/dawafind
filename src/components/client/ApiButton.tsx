"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { btn } from "../ui";

interface Props {
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  confirm?: string;
  /** Ask for a free-text reason; sent as `reason` (or `note`) in the body. */
  promptFor?: { label: string; field: "reason" | "note"; required?: boolean };
  redirectTo?: string;
}

export function ApiButton({ url, method = "PATCH", body, children, variant = "secondary", size = "sm", confirm, promptFor, redirectTo }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    let extra: Record<string, string> = {};
    if (promptFor) {
      const v = window.prompt(promptFor.label) ?? null;
      if (v === null) return;
      if (promptFor.required && !v.trim()) {
        setError("A reason is required.");
        return;
      }
      if (v.trim()) extra = { [promptFor.field]: v.trim() };
    }
    setBusy(true);
    setError(null);
    const res = await api(url, method, { ...(body as object | undefined), ...extra });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? "Something went wrong.");
    startTransition(() => {
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={run} disabled={busy} className={btn(variant, size)}>
        {busy ? "Working…" : children}
      </button>
      {error && (
        <span role="alert" className="max-w-xs text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
