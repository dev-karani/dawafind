export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export type DayHours = { open: string; close: string } | null;
export type OpeningHours = Partial<Record<Day, DayHours>>;

export const DAY_LABEL: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const defaultHours = (): OpeningHours => ({
  mon: { open: "08:00", close: "20:00" },
  tue: { open: "08:00", close: "20:00" },
  wed: { open: "08:00", close: "20:00" },
  thu: { open: "08:00", close: "20:00" },
  fri: { open: "08:00", close: "20:00" },
  sat: { open: "09:00", close: "18:00" },
  sun: null,
});

const TZ = "Africa/Nairobi";

function nowInNairobi(now: Date): { day: Day; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")!.value.toLowerCase().slice(0, 3) as Day;
  const hh = Number(parts.find((p) => p.type === "hour")!.value) % 24;
  const mm = Number(parts.find((p) => p.type === "minute")!.value);
  return { day: wd, minutes: hh * 60 + mm };
}

const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};

const fmt = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m || 0).padStart(2, "0")} ${suffix}`;
};

export interface OpenStatus {
  open: boolean | null;
  label: string;
}

export function openStatus(hours: unknown, now: Date = new Date()): OpenStatus {
  if (!hours || typeof hours !== "object") return { open: null, label: "Opening hours not provided" };
  const h = hours as OpeningHours;
  const { day, minutes } = nowInNairobi(now);
  const today = h[day];
  if (today && minutes >= toMin(today.open) && minutes < toMin(today.close)) {
    return { open: true, label: `Open now · closes ${fmt(today.close)}` };
  }
  if (today && minutes < toMin(today.open)) {
    return { open: false, label: `Closed · opens ${fmt(today.open)}` };
  }
  // find next opening day
  const idx = DAYS.indexOf(day);
  for (let i = 1; i <= 7; i++) {
    const d = DAYS[(idx + i) % 7];
    const dh = h[d];
    if (dh) return { open: false, label: `Closed · opens ${i === 1 ? "tomorrow" : DAY_LABEL[d]} ${fmt(dh.open)}` };
  }
  return { open: false, label: "Closed" };
}

export function formatDayHours(h: DayHours | undefined): string {
  return h ? `${fmt(h.open)} – ${fmt(h.close)}` : "Closed";
}
