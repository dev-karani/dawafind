import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-slate-600 md:grid-cols-2">
        <div>
          <p className="font-semibold text-slate-800">DawaFind</p>
          <p className="mt-1">Find your medicine. Compare pharmacies. Check availability.</p>
          <p className="mt-3 font-medium text-teal-800">Your prescription is not our advertising product.</p>
        </div>
        <div className="space-y-2">
          <p>
            DawaFind does not diagnose conditions, prescribe medicines or advise you to replace a prescribed medicine. Always follow
            your prescriber and pharmacist. Prescription handling is subject to applicable pharmacy practice and regulatory requirements in Kenya.
          </p>
          <p className="space-x-4">
            <Link href="/privacy" className="font-medium text-teal-800 underline">Privacy principles</Link>
            <Link href="/register/pharmacy" className="font-medium text-teal-800 underline">List your pharmacy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
