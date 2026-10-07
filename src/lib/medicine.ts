/** Pure helpers for normalising and matching medicine names. */

export interface MedicineLike {
  genericName: string;
  brandName?: string | null;
  strength: string;
  dosageForm: string;
  packSize: string;
}

const FORM_ALIASES: Record<string, string> = {
  tab: "tablet",
  tabs: "tablet",
  cap: "capsule",
  caps: "capsule",
  syp: "syrup",
  susp: "suspension",
  inj: "injection",
};

function stem(token: string): string {
  const aliased = FORM_ALIASES[token];
  if (aliased) return aliased;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/** "Amoxicillin 500 mg Capsules" → ["amoxicillin", "500mg", "capsule"] */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|ml|iu|%)/g, "$1$2")
    .replace(/[^a-z0-9.%/\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(stem);
}

export const medicineLabel = (m: MedicineLike) =>
  `${m.genericName} ${m.strength} ${m.dosageForm}`.replace(/\s+/g, " ").trim();

function haystack(m: MedicineLike): string[] {
  return tokenize(
    [m.genericName, m.brandName ?? "", m.strength, m.dosageForm, m.packSize].join(" "),
  );
}

/**
 * Every query token must match (as a prefix or substring) some token of the medicine.
 * Different strengths and dosage forms are separate Medicine rows, so they are never merged.
 */
export function matchesQuery(m: MedicineLike, query: string): boolean {
  const q = tokenize(query);
  if (q.length === 0) return false;
  const hay = haystack(m);
  return q.every((qt) => hay.some((ht) => ht.includes(qt)));
}

/** Lower is better. Generic-name prefix matches rank first, then brand matches. */
export function matchScore(m: MedicineLike, query: string): number {
  const q = tokenize(query);
  const generic = tokenize(m.genericName);
  const brand = tokenize(m.brandName ?? "");
  if (q.length && generic.some((g) => g.startsWith(q[0]))) return 0;
  if (q.length && brand.some((b) => b.startsWith(q[0]))) return 1;
  return 2;
}
