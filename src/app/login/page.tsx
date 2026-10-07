import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guard";
import { Card } from "@/components/ui";
import { Field, JsonForm } from "@/components/client/JsonForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">Sign in to DawaFind</h1>
      <Card>
        <JsonForm action="/api/auth/login" submitLabel="Sign in" redirectTo={safeNext}>
          <Field label="Email" name="email" type="email" required autoComplete="email" />
          <Field label="Password" name="password" type="password" required autoComplete="current-password" />
        </JsonForm>
        <div className="mt-4 flex justify-between text-sm">
          <Link href="/forgot-password" className="text-teal-800 underline">Forgot password?</Link>
          <Link href="/register" className="text-teal-800 underline">Create an account</Link>
        </div>
      </Card>
    </div>
  );
}
