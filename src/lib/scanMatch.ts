/**
 * Turns noisy OCR text from a prescription photo into *possible* catalogue matches.
 * It only suggests names to look up; it never decides what a patient should take.
 * Pure and dependency-free so it can be unit tested.
 */

export interface CatalogueMedicine {
  id: string;
  genericName: string;
  brandName: string | null;
  strength: string;
  dosageForm: string;
  packSize: string;
}

export interface ScanSuggestion {
  /** The name from our catalogue that matched (generic or brand). */
  name: string;
  /** The word in the scanned text it was matched from. */
  matchedWord: string;
  /** 0..1, how close the scanned word is to the catalogue name. */
  confidence: number;
  medicines: { id: string; genericName: string; brandName: string | null; strength: string; dosageForm: string; packSize: string; strengthMatch: boolean }[];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const similarity = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length);

/** Words that look like drug names (letters only, 4+ chars). Common OCR confusions are normalised. */
export function candidateWords(text: string): string[] {
  const words: string[] = [];
  for (const token of text.toLowerCase().split(/[^a-z0-9|!]+/)) {
    // Dose tokens like "500mg" are mostly digits; only repair digits inside tokens that are mostly letters.
    const letters = (token.match(/[a-z]/g) ?? []).length;
    if (letters < 4 || letters < token.length * 0.7) continue;
    const fixed = token.replace(/[10|!]/g, (c) => (c === "1" ? "l" : c === "0" ? "o" : "i")); // l/i/1 and o/0 are often confused
    if (/^[a-z]{4,}$/.test(fixed)) words.push(fixed);
  }
  return [...new Set(words)];
}

/** "500 mg", "500MG", "5OOmg" → "500mg" */
export function strengthsIn(text: string): string[] {
  const out = new Set<string>();
  // Digits may be misread as the letter O; require at least one real digit so plain words aren't affected.
  for (const m of text.toLowerCase().matchAll(/\b([0-9o]*\d[0-9o]*(?:\.\d+)?)\s*(mg|mcg|µg|g|ml|iu|%)/g)) {
    out.add(`${m[1].replace(/o/g, "0")}${m[2]}`);
  }
  return [...out];
}

const normStrength = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function nameWords(m: CatalogueMedicine): { word: string; display: string }[] {
  const out: { word: string; display: string }[] = [];
  for (const w of m.genericName.toLowerCase().split(/[^a-z]+/).filter((x) => x.length >= 4)) out.push({ word: w, display: m.genericName });
  if (m.brandName) for (const w of m.brandName.toLowerCase().split(/[^a-z]+/).filter((x) => x.length >= 4)) out.push({ word: w, display: m.brandName });
  return out;
}

/** Stricter for short words, where one wrong letter changes the drug. */
const threshold = (len: number) => (len <= 5 ? 0.8 : len <= 7 ? 0.75 : 0.7);

export function suggestMedicines(text: string, catalogue: CatalogueMedicine[], limit = 8): ScanSuggestion[] {
  const words = candidateWords(text);
  if (!words.length) return [];
  const lines = text.split(/\n+/);
  // A strength only counts for a medicine if it is written on the same line as the matched word.
  const strengthsNear = (word: string) =>
    new Set(lines.filter((l) => candidateWords(l).includes(word)).flatMap((l) => strengthsIn(l)));

  // Group catalogue rows by the (lower-cased) name word they can be found under.
  const byName = new Map<string, { display: string; rows: CatalogueMedicine[] }>();
  for (const m of catalogue) {
    for (const { word, display } of nameWords(m)) {
      const entry = byName.get(word) ?? { display, rows: [] };
      if (!entry.rows.includes(m)) entry.rows.push(m);
      byName.set(word, entry);
    }
  }

  const best = new Map<string, ScanSuggestion>();
  for (const w of words) {
    for (const [name, entry] of byName) {
      const prefix = w.length >= 5 && name.length >= 5 && (w.startsWith(name.slice(0, 5)) || name.startsWith(w.slice(0, 5)));
      const sim = Math.max(similarity(w, name), prefix ? 0.75 : 0);
      if (sim < threshold(Math.min(w.length, name.length))) continue;
      const key = entry.rows.map((r) => r.genericName).sort()[0].toLowerCase();
      const existing = best.get(key);
      if (existing && existing.confidence >= sim) continue;
      const strengths = strengthsNear(w);
      best.set(key, {
        name: entry.display,
        matchedWord: w,
        confidence: Math.round(sim * 100) / 100,
        medicines: entry.rows
          .map((r) => ({
            id: r.id,
            genericName: r.genericName,
            brandName: r.brandName,
            strength: r.strength,
            dosageForm: r.dosageForm,
            packSize: r.packSize,
            strengthMatch: strengths.has(normStrength(r.strength)),
          }))
          // Strength matches first, then neutral alphabetical order.
          .sort((a, b) => Number(b.strengthMatch) - Number(a.strengthMatch) || a.strength.localeCompare(b.strength, undefined, { numeric: true }) || a.dosageForm.localeCompare(b.dosageForm)),
      });
    }
  }
  return [...best.values()].sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name)).slice(0, limit);
}
