import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guard";
import { Card } from "@/components/ui";
import { Field, JsonForm } from "@/components/client/JsonForm";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-semibold">Create your patient account</h1>
      <p className="mb-6 text-sm text-slate-600">Search is free and doesn’t need an account. An account lets you confirm stock, reserve and track requests.</p>
      <Card>
        <JsonForm
          action="/api/auth/register"
          submitLabel="Create account"
          body={{ type: "patient", fullName: "$fullName", email: "$email", phone: "$phone", password: "$password" }}
        >
          <Field label="Full name" name="fullName" required autoComplete="name" />
          <Field label="Email" name="email" type="email" required autoComplete="email" />
          <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" placeholder="+254 7…" />
          <Field label="Password" name="password" type="password" required autoComplete="new-password" hint="At least 8 characters, with a letter and a number." />
        </JsonForm>
        <p className="mt-4 text-xs text-slate-500">
          By creating an account you agree to our <Link href="/privacy" className="underline">privacy principles</Link>. We never sell health information or use it for advertising.
        </p>
      </Card>
      <p className="mt-4 text-sm">
        Already registered? <Link href="/login" className="text-teal-800 underline">Sign in</Link>. Running a pharmacy?{" "}
        <Link href="/register/pharmacy" className="text-teal-800 underline">Register it here</Link>.
      </p>
    </div>
  );
}
