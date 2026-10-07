import type { Metadata } from "next";
import { Alert, Card } from "@/components/ui";
import { Field, JsonForm } from "@/components/client/JsonForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <Alert tone="red">This reset link is missing its token. Please request a new one.</Alert>;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">Choose a new password</h1>
      <Card>
        <JsonForm action="/api/auth/reset-password" submitLabel="Save password" body={{ token, password: "$password" }}>
          <Field label="New password" name="password" type="password" required autoComplete="new-password" hint="At least 8 characters, with a letter and a number." />
        </JsonForm>
      </Card>
    </div>
  );
}
