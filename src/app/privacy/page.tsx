import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy principles" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Privacy principles</h1>
      <Card className="border-teal-200 bg-teal-50">
        <p className="text-lg font-semibold text-teal-900">Your prescription is not our advertising product.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-teal-900">
          <li>DawaFind does not sell prescription information.</li>
          <li>DawaFind does not use prescription information for advertising.</li>
          <li>Only authorised users can access prescription information.</li>
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">How we protect health information</h2>
        <p className="mt-2 text-sm text-slate-600">
          Health-related information is sensitive personal data under Kenya’s Data Protection Act, so privacy is part of how DawaFind is built, not an afterthought.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li><strong>Consent first:</strong> you must explicitly consent before uploading a prescription, and you can withdraw consent at any time.</li>
          <li><strong>Private storage:</strong> prescription files are encrypted at rest, are never available at a public URL, and are only readable by you and the pharmacy you choose to share them with.</li>
          <li><strong>Audit trail:</strong> every access to a prescription is logged (we log who and when, never the contents).</li>
          <li><strong>Data minimisation:</strong> we ask only for what the service needs. Searches don’t require an account or precise location.</li>
          <li><strong>Retention:</strong> prescriptions are automatically and securely deleted after a fixed retention period (30 days by default) and you can delete them sooner.</li>
          <li><strong>No third-party tracking:</strong> no advertising trackers. Maps load from a third party only if you choose to show them.</li>
          <li><strong>Role-based access:</strong> pharmacy staff only see data for their own pharmacy; platform administrators cannot open prescription files.</li>
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">What DawaFind does not do</h2>
        <p className="mt-2 text-sm text-slate-600">
          DawaFind does not diagnose conditions, prescribe medicines, change prescriptions, or tell you to replace a prescribed medicine. Pharmacy results are information to help you choose; the final decision is yours, with your prescriber and pharmacist.
        </p>
      </Card>
    </div>
  );
}
