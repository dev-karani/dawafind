export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "STALE";

export interface Freshness {
  level: Confidence;
  ageMinutes: number;
  /** e.g. "12 minutes ago" */
  ago: string;
}

const HOUR = 60;

/**
 * 0–60 min   → HIGH
 * 1–6 hours  → MEDIUM
 * 6–24 hours → LOW
 * > 24 hours → STALE
 */
export function freshnessLevel(ageMinutes: number): Confidence {
  if (ageMinutes <= HOUR) return "HIGH";
  if (ageMinutes <= 6 * HOUR) return "MEDIUM";
  if (ageMinutes <= 24 * HOUR) return "LOW";
  return "STALE";
}

export function timeAgo(date: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function freshness(date: Date, now: Date = new Date()): Freshness {
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  return { level: freshnessLevel(ageMinutes), ageMinutes, ago: timeAgo(date, now) };
}

/** Plain-language stock-age sentence. Stale data is never presented as live availability. */
export function stockAgeSentence(f: Freshness): string {
  if (f.level === "STALE") return `Stock information is ${f.ago.replace(" ago", "")} old`;
  return `Stock updated ${f.ago}`;
}
