"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { btn } from "../ui";

interface Props {
  action: string;
  method?: "POST" | "PATCH" | "DELETE";
  children: ReactNode;
  submitLabel: string;
  /**
   * Declarative request body (functions can't cross the server→client boundary).
   * "$name" = trimmed value of field `name` (omitted when empty); "$name:null" = null when empty;
   * "$name:bool" = checkbox state. Anything else is sent literally. Default: all non-empty fields.
   */
  body?: BodyTemplate;
  /** Send as multipart (file uploads). */
  multipart?: boolean;
  successMessage?: string;
  /** Where to go on success. If omitted and the server returns `redirect`, that is used. */
  redirectTo?: string;
  reset?: boolean;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}

export type BodyTemplate = string | number | boolean | null | BodyTemplate[] | { [k: string]: BodyTemplate };

function build(t: BodyTemplate, fd: FormData, form: HTMLFormElement): unknown {
  if (typeof t === "string" && t.startsWith("$")) {
    const [name, mod] = t.slice(1).split(":");
    if (mod === "bool") return (form.elements.namedItem(name) as HTMLInputElement | null)?.checked ?? false;
    const v = fd.get(name);
    const s = typeof v === "string" ? v.trim() : "";
    if (s === "") return mod === "null" ? null : undefined;
    return s;
  }
  if (Array.isArray(t)) return t.map((x) => build(x, fd, form));
  if (t && typeof t === "object") return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, build(v, fd, form)]));
  return t;
}

function defaultBody(fd: FormData, form: HTMLFormElement) {
  const body: Record<string, unknown> = {};
  const checkboxes = new Set(Array.from(form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).map((c) => c.name));
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    if (checkboxes.has(k)) body[k] = true;
    else if (v.trim() !== "") body[k] = v.trim();
  }
  checkboxes.forEach((name) => {
    if (!(name in body)) body[name] = false;
  });
  return body;
}

export function JsonForm({ action, method = "POST", children, submitLabel, body: template, multipart, successMessage, redirectTo, reset, variant = "primary", className }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError(null);
    setOk(null);
    const fd = new FormData(form);
    const payload = multipart ? fd : template !== undefined ? build(template, fd, form) : defaultBody(fd, form);
    const res = await api(action, method, payload);
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? "Something went wrong.");
    if (successMessage || res.data.message) setOk(res.data.message ?? successMessage ?? "Saved.");
    if (reset) ref.current?.reset();
    const dest = redirectTo ?? res.data.redirect;
    if (dest) {
      router.push(dest);
    }
    router.refresh();
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className={className ?? "space-y-4"} noValidate={false}>
      {children}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </p>
      )}
      <button type="submit" disabled={busy} className={btn(variant)}>
        {busy ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  hint,
  autoComplete,
  min,
  max,
  step,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  min?: number;
  max?: number;
  step?: number | string;
  inputMode?: "numeric" | "decimal" | "tel" | "email" | "text";
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
        {required && <span aria-hidden className="text-red-600"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        autoComplete={autoComplete}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
        {required && <span aria-hidden className="text-red-600"> *</span>}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextAreaField({ label, name, rows = 3, placeholder }: { label: string; name: string; rows?: number; placeholder?: string }) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
      />
    </div>
  );
}

export function Check({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-800">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
      <span>
        {label}
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}
