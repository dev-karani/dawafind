// Copies the on-device OCR engine (worker, WebAssembly core, English model) into public/ocr so that
// prescription scanning never loads code or data from a third-party CDN, and photos never leave the browser.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");
const core = join(root, "node_modules", "tesseract.js-core");
const worker = join(root, "node_modules", "tesseract.js", "dist", "worker.min.js");
const model = join(root, "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz");

if (!existsSync(core) || !existsSync(worker) || !existsSync(model)) {
  console.warn("[ocr] tesseract.js assets not installed; skipping (prescription scanning will be unavailable).");
  process.exit(0);
}

mkdirSync(join(out, "lang"), { recursive: true });
cpSync(worker, join(out, "worker.min.js"));
// Only the LSTM builds are needed (the model uses the LSTM engine).
for (const f of readdirSync(core)) {
  if (/^tesseract-core.*lstm.*\.(js|wasm)$/.test(f)) cpSync(join(core, f), join(out, f));
}
cpSync(model, join(out, "lang", "eng.traineddata.gz"));
console.log("[ocr] copied OCR assets to public/ocr");
