import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { Field, JsonForm } from "@/components/client/JsonForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">Reset your password</h1>
      <Card>
        <JsonForm action="/api/auth/forgot-password" submitLabel="Send reset link" successMessage="If an account exists for that email, we've sent a reset link.">
          <Field label="Email" name="email" type="email" required autoComplete="email" />
        </JsonForm>
      </Card>
    </div>
  );
}
