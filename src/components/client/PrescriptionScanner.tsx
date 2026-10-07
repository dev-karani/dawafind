"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ScanSuggestion } from "@/lib/scanMatch";
import { api } from "./api";
import { btn, inputClass } from "../ui";

type Phase = "idle" | "reading" | "matching" | "done";

/** Downscale, greyscale and stretch contrast so faint handwriting stands out. Runs entirely in the browser. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const longest = Math.max(bmp.width, bmp.height);
  const scale = longest > 2200 ? 2200 / longest : longest < 1200 ? Math.min(2, 1600 / longest) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  const total = d.length / 4;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc > total * 0.02) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc > total * 0.2) {
      hi = v;
      break;
    }
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function PrescriptionScanner() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<ScanSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  async function match(t: string) {
    setPhase("matching");
    setError(null);
    const res = await api<{ suggestions: ScanSuggestion[] }>("/api/scan/match", "POST", { text: t });
    if (!res.ok) {
      setError(res.data.error ?? "Couldn’t look that up. Please try again.");
      setPhase("done");
      return;
    }
    setSuggestions(res.data.suggestions);
    setPhase("done");
  }

  async function onFile(file: File) {
    setError(null);
    setSuggestions(null);
    setText("");
    if (!file.type.startsWith("image/")) return setError("Please choose a photo (JPG or PNG).");
    if (file.size > 15 * 1024 * 1024) return setError("That photo is too large. Try a smaller one (under 15 MB).");

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreview(url);
    setPhase("reading");
    setProgress(0);
    setStatusText("Preparing photo…");

    let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;
    try {
      const canvas = await prepare(file);
      const { createWorker } = await import("tesseract.js");
      setStatusText("Loading reader (first time only)…");
      worker = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr/lang",
        gzip: true,
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setStatusText("Reading handwriting…");
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(canvas);
      const cleaned = data.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      setText(cleaned);
      if (cleaned.replace(/[^a-z]/gi, "").length < 4) {
        setSuggestions([]);
        setPhase("done");
        return;
      }
      await match(cleaned);
    } catch {
      setError("We couldn’t read that photo on this device. You can type the medicine name below instead.");
      setPhase("done");
    } finally {
      await worker?.terminate().catch(() => {});
    }
  }

  function reset() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setText("");
    setSuggestions(null);
    setError(null);
    setPhase("idle");
    if (fileRef.current) fileRef.current.value = "";
  }

  const busy = phase === "reading" || phase === "matching";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          id="rx-photo"
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <label htmlFor="rx-photo" className={`${btn("primary")} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          📷 Take or upload a photo of your prescription
        </label>
        {phase !== "idle" && !busy && (
          <button type="button" onClick={reset} className={btn("secondary")}>Start over</button>
        )}
      </div>
      <p className="text-xs text-slate-600">
        Your photo is read on your device and is <strong>never uploaded or saved</strong>. Only the text you see below is sent to look up names. Handwriting is hard to read — always check the result.
      </p>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {(preview || busy) && (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your prescription photo (shown only on this device)" className="max-h-64 w-full rounded-lg border border-slate-200 object-contain bg-slate-50" />
          )}
          <div>
            {busy && (
              <div role="status" aria-live="polite">
                <p className="text-sm font-medium text-slate-800">{phase === "matching" ? "Finding matching medicines…" : statusText}</p>
                {phase === "reading" && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            )}
            {phase === "done" && (
              <div>
                <label htmlFor="rx-text" className="mb-1 block text-sm font-medium text-slate-800">What we read — fix anything that’s wrong</label>
                <textarea
                  id="rx-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  className={`${inputClass} font-mono text-xs`}
                  placeholder="Type the medicine name and strength, e.g. Amoxicillin 500mg"
                />
                <button type="button" onClick={() => match(text)} className={`${btn("secondary", "sm")} mt-2`} disabled={text.trim().length < 4}>
                  Find matches again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === "idle" && (
        <details className="text-sm">
          <summary className="cursor-pointer text-teal-800 underline">Or type what’s written</summary>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input value={text} onChange={(e) => setText(e.target.value)} className={inputClass} placeholder="e.g. Amoxicillin 500mg" maxLength={200} aria-label="Type what's written on your prescription" />
            <button type="button" className={btn("secondary")} disabled={text.trim().length < 4} onClick={() => { setPhase("done"); void match(text); }}>Find matches</button>
          </div>
        </details>
      )}

      {phase === "done" && suggestions && (
        <div aria-live="polite">
          {suggestions.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              We couldn’t recognise a medicine name. Try a clearer, well-lit photo, edit the text above, or{" "}
              <Link href="/search" className="underline">search by name</Link>.
            </p>
          ) : (
            <>
              <h3 className="mb-2 font-semibold">Possible matches — choose the one on your prescription</h3>
              <ul className="space-y-3">
                {suggestions.map((s) => (
                  <li key={s.name} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-600">
                      Read “<span className="font-mono">{s.matchedWord}</span>” → <strong className="text-slate-900">{s.name}</strong>
                      {s.confidence < 0.9 && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">check spelling</span>}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {s.medicines.map((m) => (
                        <li key={m.id}>
                          <Link
                            href={`/search?medicineId=${m.id}&q=${encodeURIComponent(s.name)}`}
                            className={`inline-block rounded-lg border px-3 py-2 text-sm hover:bg-teal-50 ${m.strengthMatch ? "border-teal-600 bg-teal-50 font-medium" : "border-slate-300"}`}
                          >
                            {m.genericName} {m.strength} {m.dosageForm}
                            {m.strengthMatch && <span className="ml-1 text-xs text-teal-800">✓ strength seen</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-600">
                These are guesses from the photo. DawaFind doesn’t diagnose, prescribe or suggest substitutes — confirm the exact medicine, strength and form with your prescriber or pharmacist.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
