/**
 * Bulk development data: dozens of extra pharmacies spread across Kenyan towns, each with its own
 * pricing personality (budget, standard, premium, wildly variable) so comparisons show real price spread.
 * Safe to re-run: pharmacies are keyed by email (bulkNN@dawafind.test) and existing rows are skipped.
 * NEVER run against production.
 *   npm run db:bulk            (default 60 pharmacies)
 *   COUNT=150 npm run db:bulk  (more)
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultHours } from "../src/lib/hours";
import { deriveStockStatus } from "../src/lib/pricing";
import { AREAS } from "../src/lib/areas";

const db = new PrismaClient();
const PASSWORD = "Password123";
const COUNT = Math.max(1, Math.min(500, Number(process.env.COUNT ?? 60)));
const mins = (n: number) => new Date(Date.now() - n * 60_000);
const hours = (n: number) => mins(n * 60);

let state = 7_654_321;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

const PREFIX = ["Afya", "Tiba", "Jamii", "Uzima", "Neema", "Baraka", "Sunrise", "Evergreen", "Faraja", "Imara", "Pwani", "Savannah", "Highland", "Rift", "Lakeside", "Crescent", "Umoja", "Amani", "Wema", "Zuri", "Metro", "City", "Prime", "Trust", "Hope", "Vital", "Care", "Unity", "Mount", "Nile"];
const SUFFIX = ["Pharmacy", "Chemist", "Drugstore", "Medic Pharmacy", "Health Pharmacy", "Family Chemist", "Community Pharmacy", "Pharmacy & Wellness"];
const STREETS = ["Kenyatta Ave", "Moi Ave", "Tom Mboya St", "River Rd", "Market St", "Station Rd", "Hospital Rd", "Uhuru Hwy", "Mombasa Rd", "Ngong Rd", "Lang'ata Rd", "Juja Rd", "Outer Ring Rd", "Kiambu Rd", "Waiyaki Way", "Lunga Lunga Rd"];
const FIRST = ["Achieng", "Brian", "Cynthia", "Daniel", "Esther", "Faith", "George", "Halima", "Isaac", "Jane", "Kevin", "Lucy", "Moses", "Naomi", "Omar", "Peter", "Quinter", "Ruth", "Samuel", "Tabitha", "Victor", "Winnie", "Yusuf", "Zawadi"];
const LAST = ["Otieno", "Mwangi", "Wanjiru", "Kiprono", "Abdalla", "Njoroge", "Akinyi", "Mutua", "Chebet", "Hassan", "Kamau", "Odhiambo", "Wafula", "Naliaka", "Mohamed", "Kariuki", "Rotich", "Atieno"];

/** Pricing personalities: [label, base multiplier, per-item noise, share of catalogue stocked]. */
const PERSONALITIES = [
  { label: "budget", mult: 0.82, noise: 0.1, coverage: [0.5, 0.8], weight: 3 },
  { label: "standard", mult: 1.0, noise: 0.12, coverage: [0.5, 0.85], weight: 5 },
  { label: "premium", mult: 1.22, noise: 0.1, coverage: [0.7, 0.95], weight: 2 },
  { label: "erratic", mult: 1.0, noise: 0.35, coverage: [0.4, 0.8], weight: 2 },
] as const;
const personalityBag = PERSONALITIES.flatMap((p) => Array(p.weight).fill(p) as (typeof PERSONALITIES)[number][]);

/** Reasonable typical prices (KSh) by generic name when we have no listings yet. */
const FALLBACK: Record<string, number> = {};

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production.");
  if ((await db.user.count()) === 0) {
    console.log("Run `npm run db:seed` first.");
    return;
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const medicines = await db.medicine.findMany({ where: { status: "ACTIVE" } });

  // Typical price per medicine = average of existing listings.
  const avg = await db.inventoryItem.groupBy({ by: ["medicineId"], _avg: { price: true } });
  const typical = new Map<string, number>();
  for (const a of avg) if (a._avg.price) typical.set(a.medicineId, a._avg.price);
  for (const m of medicines) if (!typical.has(m.id)) typical.set(m.id, FALLBACK[m.genericName] ?? 300);

  // Towns weighted so Nairobi gets the most pharmacies.
  const townAreas = [...AREAS, ...AREAS.filter((a) => a.town === "Nairobi"), ...AREAS.filter((a) => a.town === "Nairobi")];

  let createdPharmacies = 0;
  let createdItems = 0;
  const names = new Set((await db.pharmacy.findMany({ select: { name: true } })).map((p) => p.name));

  for (let n = 1; n <= COUNT; n++) {
    const key = `bulk${String(n).padStart(3, "0")}`;
    const email = `${key}@dawafind.test`;
    if (await db.user.findUnique({ where: { email } })) continue;

    let name = `${pick(PREFIX)} ${pick(SUFFIX)}`;
    while (names.has(name)) name = `${pick(PREFIX)} ${pick(SUFFIX)} ${pick(["Plus", "Express", "II", "Annex", "Central"])}`;
    names.add(name);

    const area = pick(townAreas);
    const personality = pick(personalityBag);
    const pharmacist = `Dr. ${pick(FIRST)} ${pick(LAST)}`;
    const pending = rand() < 0.07;
    const hasDelivery = rand() < 0.65;
    const open24 = rand() < 0.08;
    const phone = `+254 7${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`;

    const user = await db.user.create({
      data: { fullName: pharmacist, email, passwordHash, role: "PHARMACY_ADMIN", phone },
    });
    const allDay = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, { open: "00:00", close: "23:59" }]));
    const ph = await db.pharmacy.create({
      data: {
        name,
        address: `${pick(STREETS)}, ${area.label}`,
        area: area.label,
        town: area.town,
        // Jitter within roughly 3 km of the area centre.
        latitude: area.lat + (rand() - 0.5) * 0.05,
        longitude: area.lng + (rand() - 0.5) * 0.05,
        phone,
        email,
        openingHours: (open24 ? allDay : defaultHours()) as Prisma.InputJsonValue,
        deliveryAvailable: hasDelivery,
        deliveryFee: hasDelivery ? round5(int(40, 200)) : 0,
        deliveryEtaMinutes: hasDelivery ? int(25, 90) : null,
        licenseReference: `PPB/PREM/${int(2019, 2026)}/${String(int(1, 99999)).padStart(5, "0")}`,
        responsiblePharmacist: pharmacist,
        verificationStatus: pending ? "PENDING" : "VERIFIED",
        verifiedAt: pending ? null : hours(24 * int(3, 400)),
        staff: { create: { userId: user.id, role: "PHARMACY_ADMIN" } },
        plans: { create: { planName: personality.label === "premium" ? "GROWTH" : "BASIC", monthlyFee: personality.label === "premium" ? 3500 : 0 } },
      },
    });
    createdPharmacies++;

    const [lo, hi] = personality.coverage;
    const coverage = lo + rand() * (hi - lo);
    const items: Prisma.InventoryItemCreateManyInput[] = [];
    for (const m of medicines) {
      if (rand() > coverage) continue;
      const base = typical.get(m.id) ?? 300;
      // Pharmacy personality × per-item noise, plus the occasional outlier (very cheap or very dear).
      let price = base * personality.mult * (1 + (rand() * 2 - 1) * personality.noise);
      const o = rand();
      if (o < 0.04) price *= 0.65;
      else if (o > 0.96) price *= 1.5;
      price = round5(price);
      const minimumPrice = Math.min(price, round5(price * (0.75 + rand() * 0.15)));
      const r = rand();
      const quantity = r < 0.1 ? 0 : r < 0.28 ? int(1, 10) : int(11, 150);
      const a = rand();
      const age = a < 0.5 ? int(2, 55) : a < 0.75 ? int(70, 340) : a < 0.92 ? int(370, 1400) : int(1500, 5000);
      const promo = rand() < 0.07;
      items.push({
        pharmacyId: ph.id,
        medicineId: m.id,
        price,
        minimumPrice,
        quantity,
        stockStatus: deriveStockStatus(quantity),
        lastStockUpdate: mins(age),
        lastPriceUpdate: mins(age + int(5, 900)),
        deliveryAvailable: hasDelivery && rand() > 0.12,
        ...(promo ? { promotionsEnabled: true, promoPrice: Math.max(minimumPrice, round5(price * 0.92)) } : {}),
      });
    }
    await db.inventoryItem.createMany({ data: items });
    createdItems += items.length;
  }

  const totals = {
    pharmacies: await db.pharmacy.count(),
    verified: await db.pharmacy.count({ where: { verificationStatus: "VERIFIED" } }),
    inventory: await db.inventoryItem.count(),
  };
  console.log(`Added ${createdPharmacies} pharmacies and ${createdItems} inventory rows. Totals now:`, totals);
  console.log(`Pharmacy admin logins: bulk001@dawafind.test … bulk${String(COUNT).padStart(3, "0")}@dawafind.test (password "${PASSWORD}")`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
