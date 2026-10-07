import Link from "next/link";
import { SearchForm } from "@/components/client/SearchForm";
import { PrescriptionScanner } from "@/components/client/PrescriptionScanner";
import { Card, btn } from "@/components/ui";

const steps = [
  { t: "Find", d: "Search the exact strength and form that was prescribed." },
  { t: "Compare", d: "See price, stock freshness, distance, delivery and the estimated total." },
  { t: "Confirm", d: "Ask the pharmacy to confirm stock and price before you travel." },
  { t: "Reserve", d: "Ask a verified pharmacy to hold your medicine for collection." },
  { t: "Get", d: "Collect it, or choose delivery where the pharmacy offers it." },
];

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="rounded-3xl bg-gradient-to-br from-teal-800 to-teal-600 px-6 py-12 text-white shadow-sm md:px-12 md:py-16">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
          Find your medicine. Compare pharmacies. Check availability.
        </h1>
        <p className="mt-4 max-w-2xl text-teal-50 md:text-lg">
          Stop calling around. See which verified pharmacies list your prescribed medicine, how recent their stock information is, and what it will really cost.
        </p>
        <div className="mt-8 max-w-3xl rounded-2xl bg-white p-4 text-slate-900 shadow-lg">
          <SearchForm />
        </div>
        <p className="mt-4 text-sm text-teal-50">
          Have a handwritten prescription?{" "}
          <a href="#scan" className="font-semibold underline">Scan it with your camera ↓</a>
        </p>
      </section>

      <section aria-labelledby="scan" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="scan" className="text-xl font-semibold">Have a prescription? Scan it</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Take a photo of your doctor’s handwriting and we’ll try to read the medicine names, then let you compare pharmacies for the one you choose.
        </p>
        <PrescriptionScanner />
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="mb-4 text-xl font-semibold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.t}>
              <Card className="h-full">
                <p className="text-xs font-semibold text-teal-700">Step {i + 1}</p>
                <p className="mt-1 text-lg font-semibold">{s.t}</p>
                <p className="mt-1 text-sm text-slate-600">{s.d}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="font-semibold">Honest information</h3>
          <p className="mt-1 text-sm text-slate-600">
            Every listing shows when stock and price were last updated. Old information is clearly marked — we never present it as live availability.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold">You decide</h3>
          <p className="mt-1 text-sm text-slate-600">
            No hidden “best pharmacy” ranking. Sort by price, total cost, distance or freshest stock. Fees are always itemised.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold">Private by design</h3>
          <p className="mt-1 text-sm text-slate-600">
            Prescriptions are encrypted, visible only to you and the pharmacy you choose, and never used for advertising.{" "}
            <Link href="/privacy" className="font-medium text-teal-800 underline">Read our principles</Link>.
          </p>
        </Card>
      </section>

      <section className="rounded-2xl border border-teal-200 bg-teal-50 p-6 md:flex md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-teal-900">Own or manage a pharmacy?</h2>
          <p className="mt-1 text-sm text-teal-900/80">Reach more customers while keeping control of your prices, stock and margins.</p>
        </div>
        <Link href="/register/pharmacy" className={`${btn("primary")} mt-4 md:mt-0`}>List your pharmacy</Link>
      </section>
    </div>
  );
}
