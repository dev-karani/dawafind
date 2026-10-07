/**
 * Additive development data: more medicines, pharmacies in more towns, a fuller inventory,
 * more patients and a realistic history of orders, reservations and requests.
 * Safe to re-run (skips anything that already exists). NEVER run against production.
 *   npm run db:more     (after npm run db:seed)
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultHours } from "../src/lib/hours";
import { deriveStockStatus } from "../src/lib/pricing";

const db = new PrismaClient();
const PASSWORD = "Password123";
const mins = (n: number) => new Date(Date.now() - n * 60_000);
const hours = (n: number) => mins(n * 60);

// Deterministic pseudo-random so re-seeding produces the same shape of data.
let state = 20260706;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

// generic, brand, strength, form, pack, typical price (KSh)
const NEW_MEDICINES: [string, string | null, string, string, string, number][] = [
  ["Ibuprofen", null, "200mg", "Tablets", "Pack of 30", 120],
  ["Diclofenac", "Voltaren", "50mg", "Tablets", "Pack of 20", 220],
  ["Aspirin", "Cardiprin", "75mg", "Tablets", "Pack of 28", 260],
  ["Metronidazole", "Flagyl", "400mg", "Tablets", "Pack of 21", 170],
  ["Co-trimoxazole", "Septrin", "480mg", "Tablets", "Pack of 20", 140],
  ["Cefuroxime", "Zinnat", "500mg", "Tablets", "Pack of 10", 780],
  ["Erythromycin", null, "500mg", "Tablets", "Pack of 28", 520],
  ["Fluconazole", "Diflucan", "150mg", "Capsules", "Pack of 1", 260],
  ["Albendazole", "Zentel", "400mg", "Tablets", "Pack of 1", 110],
  ["Loratadine", "Clarityn", "10mg", "Tablets", "Pack of 10", 190],
  ["Chlorphenamine", "Piriton", "4mg", "Tablets", "Pack of 28", 90],
  ["Lisinopril", "Zestril", "10mg", "Tablets", "Pack of 28", 430],
  ["Enalapril", null, "10mg", "Tablets", "Pack of 28", 320],
  ["Atenolol", "Tenormin", "50mg", "Tablets", "Pack of 28", 290],
  ["Furosemide", "Lasix", "40mg", "Tablets", "Pack of 28", 180],
  ["Simvastatin", "Zocor", "20mg", "Tablets", "Pack of 28", 520],
  ["Glibenclamide", "Daonil", "5mg", "Tablets", "Pack of 30", 210],
  ["Gliclazide", "Diamicron", "80mg", "Tablets", "Pack of 60", 640],
  ["Levothyroxine", "Eltroxin", "50mcg", "Tablets", "Pack of 100", 890],
  ["Salbutamol", null, "2mg", "Tablets", "Pack of 28", 130],
  ["Budesonide", "Pulmicort", "200mcg", "Inhaler", "200 doses", 1850],
  ["Folic Acid", null, "5mg", "Tablets", "Pack of 28", 100],
  ["Ferrous Sulphate", null, "200mg", "Tablets", "Pack of 30", 150],
  ["Vitamin C", "Redoxon", "1000mg", "Effervescent", "Pack of 10", 480],
  ["Zinc Sulphate", null, "20mg", "Dispersible tablets", "Pack of 10", 120],
  ["Hyoscine Butylbromide", "Buscopan", "10mg", "Tablets", "Pack of 20", 340],
  ["Omeprazole", null, "40mg", "Capsules", "Pack of 14", 560],
  ["Loperamide", "Imodium", "2mg", "Capsules", "Pack of 6", 160],
  ["Clotrimazole", "Canesten", "1%", "Cream", "20g tube", 310],
  ["Hydrocortisone", null, "1%", "Cream", "15g tube", 250],
  ["Artesunate", null, "60mg", "Injection", "Vial", 650],
  ["Medroxyprogesterone", "Depo-Provera", "150mg/ml", "Injection", "1ml vial", 400],
  ["Levonorgestrel", "Postinor-2", "1.5mg", "Tablets", "Pack of 1", 300],
  ["Insulin Human Mixtard", "Mixtard 30", "100IU/ml", "Injection", "10ml vial", 1900],
];

interface NewPharmacy {
  key: string;
  name: string;
  address: string;
  area: string;
  town: string;
  lat: number;
  lng: number;
  delivery?: { fee: number; eta: number };
  status: "VERIFIED" | "PENDING";
  pharmacist: string;
  /** Price multiplier vs typical price, to give genuine variety. */
  factor: number;
  /** Share of the catalogue this pharmacy stocks. */
  coverage: number;
  open24h?: boolean;
}

const NEW_PHARMACIES: NewPharmacy[] = [
  { key: "kasarani", name: "Kasarani Community Pharmacy", address: "Thika Rd, Kasarani", area: "Kasarani", town: "Nairobi", lat: -1.2218, lng: 36.8979, delivery: { fee: 120, eta: 55 }, status: "VERIFIED", pharmacist: "Dr. Daniel Mutua", factor: 0.95, coverage: 0.7 },
  { key: "cbdmeds", name: "Moi Avenue Meds", address: "Tom Mboya St, Nairobi CBD", area: "Nairobi CBD", town: "Nairobi", lat: -1.2837, lng: 36.8267, delivery: { fee: 60, eta: 30 }, status: "VERIFIED", pharmacist: "Dr. Lucy Wairimu", factor: 0.92, coverage: 0.85 },
  { key: "kilimaniplus", name: "Kilimani Plus Pharmacy", address: "Dennis Pritt Rd, Kilimani", area: "Kilimani", town: "Nairobi", lat: -1.2899, lng: 36.7897, delivery: { fee: 100, eta: 40 }, status: "VERIFIED", pharmacist: "Dr. Naomi Chebet", factor: 1.08, coverage: 0.8 },
  { key: "rongai", name: "Rongai Family Chemist", address: "Magadi Rd, Rongai", area: "Rongai", town: "Kajiado", lat: -1.3951, lng: 36.7601, status: "VERIFIED", pharmacist: "Dr. Joseph Lekishon", factor: 0.97, coverage: 0.55 },
  { key: "thika", name: "Thika Road Pharmacy", address: "Kenyatta Hwy, Thika", area: "Thika Town", town: "Thika", lat: -1.0349, lng: 37.0711, delivery: { fee: 150, eta: 70 }, status: "VERIFIED", pharmacist: "Dr. Ann Njuguna", factor: 0.96, coverage: 0.6 },
  { key: "mombasacbd", name: "Coast Care Pharmacy", address: "Digo Rd, Mombasa CBD", area: "Mombasa CBD", town: "Mombasa", lat: -4.0467, lng: 39.6672, delivery: { fee: 120, eta: 50 }, status: "VERIFIED", pharmacist: "Dr. Mariam Hassan", factor: 1.02, coverage: 0.75 },
  { key: "nakuru", name: "Nakuru Central Pharmacy", address: "Kenyatta Ave, Nakuru", area: "Nakuru Town", town: "Nakuru", lat: -0.3028, lng: 36.0723, delivery: { fee: 130, eta: 60 }, status: "VERIFIED", pharmacist: "Dr. Kevin Rotich", factor: 0.99, coverage: 0.7 },
  { key: "eldoret", name: "Eldoret Wellness Pharmacy", address: "Uganda Rd, Eldoret", area: "Eldoret Town", town: "Eldoret", lat: 0.5157, lng: 35.2711, delivery: { fee: 130, eta: 65 }, status: "VERIFIED", pharmacist: "Dr. Beatrice Jeptoo", factor: 1.0, coverage: 0.65 },
  { key: "kisumuplus", name: "Kisumu Lakeview Pharmacy", address: "Ang'awa Ave, Kisumu", area: "Kisumu Town", town: "Kisumu", lat: -0.1015, lng: 34.7524, delivery: { fee: 100, eta: 45 }, status: "VERIFIED", pharmacist: "Dr. Collins Owino", factor: 0.98, coverage: 0.7 },
  { key: "westnight", name: "Westlands 24hr Pharmacy", address: "Mpaka Rd, Westlands", area: "Westlands", town: "Nairobi", lat: -1.2651, lng: 36.8039, delivery: { fee: 150, eta: 35 }, status: "VERIFIED", pharmacist: "Dr. Ruth Kamau", factor: 1.15, coverage: 0.9, open24h: true },
  { key: "southbpending", name: "South B Wellness Chemist", address: "Plainsview Rd, South B", area: "South B", town: "Nairobi", lat: -1.3112, lng: 36.8342, status: "PENDING", pharmacist: "Dr. Isaac Maina", factor: 1.0, coverage: 0.4 },
];

const PATIENTS: [string, string, string | null][] = [
  ["Achieng Adhiambo", "achieng@dawafind.test", "kisumu"],
  ["Brian Kiprop", "brian@dawafind.test", "eldoret"],
  ["Cynthia Wambui", "cynthia@dawafind.test", "kilimani"],
  ["David Mwangi", "david@dawafind.test", "nairobi-cbd"],
  ["Esther Nyambura", "esther@dawafind.test", "thika"],
  ["Farid Abdalla", "farid@dawafind.test", "mombasa-cbd"],
  ["Grace Chepkoech", "grace@dawafind.test", "nakuru"],
  ["Hassan Omar", "hassan@dawafind.test", "eastleigh"],
  ["Irene Mutheu", "irene@dawafind.test", "kasarani"],
  ["James Otieno", "james@dawafind.test", "westlands"],
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production.");
  if ((await db.user.count()) === 0) {
    console.log("Run `npm run db:seed` first.");
    return;
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await db.platformSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const admin = await db.user.findFirst({ where: { role: "PLATFORM_ADMIN" } });

  // ── medicines ──
  const typical = new Map<string, number>();
  let addedMeds = 0;
  for (const [genericName, brandName, strength, dosageForm, packSize, price] of NEW_MEDICINES) {
    const existing = await db.medicine.findFirst({ where: { genericName, brandName, strength, dosageForm, packSize } });
    const m = existing ?? (await db.medicine.create({ data: { genericName, brandName, strength, dosageForm, packSize } }));
    if (!existing) addedMeds++;
    typical.set(m.id, price);
  }
  // Rough typical prices for the original catalogue (derived from existing listings).
  const existingItems = await db.inventoryItem.groupBy({ by: ["medicineId"], _avg: { price: true } });
  for (const e of existingItems) if (e._avg.price && !typical.has(e.medicineId)) typical.set(e.medicineId, Math.round(e._avg.price));
  const medicines = await db.medicine.findMany({ where: { status: "ACTIVE" } });
  for (const m of medicines) if (!typical.has(m.id)) typical.set(m.id, 300);

  // ── pharmacies ──
  let addedPharmacies = 0;
  for (const p of NEW_PHARMACIES) {
    if (await db.user.findUnique({ where: { email: `${p.key}@dawafind.test` } })) continue;
    const user = await db.user.create({
      data: { fullName: p.pharmacist, email: `${p.key}@dawafind.test`, passwordHash, role: "PHARMACY_ADMIN", phone: `+254 700 2${String(addedPharmacies).padStart(2, "0")} 000` },
    });
    const allDay = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, { open: "00:00", close: "23:59" }]));
    await db.pharmacy.create({
      data: {
        name: p.name,
        address: p.address,
        area: p.area,
        town: p.town,
        latitude: p.lat,
        longitude: p.lng,
        phone: user.phone ?? "+254 700 200 000",
        email: `${p.key}@dawafind.test`,
        openingHours: (p.open24h ? allDay : defaultHours()) as Prisma.InputJsonValue,
        deliveryAvailable: !!p.delivery,
        deliveryFee: p.delivery?.fee ?? 0,
        deliveryEtaMinutes: p.delivery?.eta ?? null,
        licenseReference: `PPB/PREM/2025/${String(1000 + addedPharmacies * 37)}`,
        responsiblePharmacist: p.pharmacist,
        verificationStatus: p.status,
        verifiedAt: p.status === "VERIFIED" ? hours(24 * int(5, 200)) : null,
        staff: { create: { userId: user.id, role: "PHARMACY_ADMIN" } },
        plans: { create: { planName: p.factor > 1.05 ? "GROWTH" : "BASIC", monthlyFee: p.factor > 1.05 ? 3500 : 0 } },
      },
    });
    addedPharmacies++;
  }

  // ── inventory for every verified pharmacy (never overwrites existing rows) ──
  const pharmacies = await db.pharmacy.findMany({ where: { verificationStatus: "VERIFIED" } });
  const factors = new Map(NEW_PHARMACIES.map((p) => [p.name, p]));
  let addedItems = 0;
  for (const ph of pharmacies) {
    const cfg = factors.get(ph.name);
    const factor = cfg?.factor ?? 1;
    const coverage = cfg?.coverage ?? 0.6;
    for (const m of medicines) {
      if (rand() > coverage) continue;
      if (await db.inventoryItem.findUnique({ where: { pharmacyId_medicineId: { pharmacyId: ph.id, medicineId: m.id } } })) continue;
      const base = typical.get(m.id) ?? 300;
      const price = Math.max(20, Math.round((base * factor * (0.92 + rand() * 0.16)) / 5) * 5);
      const minimumPrice = Math.max(10, Math.round((price * (0.78 + rand() * 0.1)) / 5) * 5);
      const r = rand();
      const quantity = r < 0.12 ? 0 : r < 0.3 ? int(1, 10) : int(11, 120);
      // Mostly fresh, some a few hours old, a few stale.
      const a = rand();
      const age = a < 0.5 ? int(3, 55) : a < 0.75 ? int(70, 340) : a < 0.92 ? int(370, 1400) : int(1500, 4500);
      await db.inventoryItem.create({
        data: {
          pharmacyId: ph.id,
          medicineId: m.id,
          price,
          minimumPrice,
          quantity,
          stockStatus: deriveStockStatus(quantity),
          lastStockUpdate: mins(age),
          lastPriceUpdate: mins(age + int(5, 600)),
          deliveryAvailable: ph.deliveryAvailable && rand() > 0.15,
          // A few promotions, always at or above the floor.
          ...(rand() < 0.08 ? { promotionsEnabled: true, promoPrice: Math.max(minimumPrice, Math.round(price * 0.93)) } : {}),
        },
      });
      addedItems++;
    }
  }

  // ── patients ──
  const patientUsers = [];
  for (const [fullName, email, defaultArea] of PATIENTS) {
    const existing = await db.user.findUnique({ where: { email } });
    patientUsers.push(
      existing ??
        (await db.user.create({
          data: { fullName, email, passwordHash, role: "PATIENT", patientProfile: { create: { defaultArea } } },
        })),
    );
  }
  const allPatients = await db.user.findMany({ where: { role: "PATIENT" } });

  // ── history: only add once ──
  const historyMarker = await db.auditLog.findFirst({ where: { action: "seed.more" } });
  let orders = 0;
  let live = 0;
  if (!historyMarker) {
    const stocked = await db.inventoryItem.findMany({
      where: { quantity: { gte: 10 }, pharmacy: { verificationStatus: "VERIFIED" } },
      include: { pharmacy: true },
    });

    // Completed / cancelled orders over the last 60 days.
    for (let i = 0; i < 90; i++) {
      const item = pick(stocked);
      const patient = pick(allPatients);
      const qty = int(1, 3);
      const delivery = item.pharmacy.deliveryAvailable && item.deliveryAvailable && rand() < 0.35;
      const deliveryFee = delivery ? item.pharmacy.deliveryFee : 0;
      const subtotal = item.price * qty;
      const when = hours(int(6, 24 * 60));
      const cancelled = rand() < 0.1;
      await db.order.create({
        data: {
          patientId: patient.id,
          pharmacyId: item.pharmacyId,
          fulfilment: delivery ? "DELIVERY" : "PICKUP",
          subtotal,
          deliveryFee,
          serviceFee: 20,
          total: subtotal + deliveryFee + 20,
          status: cancelled ? "CANCELLED" : "COMPLETED",
          paymentStatus: cancelled ? "UNPAID" : "PAID",
          deliveryAddress: delivery ? "Apartment 4B, Riverside Drive" : null,
          createdAt: when,
          completedAt: cancelled ? null : when,
          items: { create: [{ medicineId: item.medicineId, quantity: qty, unitPrice: item.price }] },
        },
      });
      orders++;
    }

    // Live work for pharmacy dashboards: pending/confirmed reservations, open stock requests, active delivery orders.
    const liveItems = stocked.filter((s) => s.quantity >= 12).slice(0, 80);
    for (let i = 0; i < Math.min(24, liveItems.length); i++) {
      const item = liveItems[i];
      const patient = pick(allPatients);
      const status = i % 3 === 0 ? "CONFIRMED" : "PENDING";
      await db.reservation.create({
        data: {
          patientId: patient.id,
          pharmacyId: item.pharmacyId,
          medicineId: item.medicineId,
          quantity: 1,
          unitPrice: item.price,
          serviceFee: 20,
          totalPrice: item.price + 20,
          status,
          expiresAt: new Date(Date.now() + int(30, 150) * 60_000),
          createdAt: mins(int(2, 90)),
        },
      });
      live++;
    }
    for (let i = 24; i < Math.min(40, liveItems.length); i++) {
      const item = liveItems[i];
      await db.stockConfirmation.create({
        data: {
          patientId: pick(allPatients).id,
          pharmacyId: item.pharmacyId,
          medicineId: item.medicineId,
          requestedQuantity: int(1, 2),
          expiresAt: new Date(Date.now() + int(40, 110) * 60_000),
          createdAt: mins(int(1, 50)),
        },
      });
      live++;
    }
    const deliverable = stocked.filter((s) => s.pharmacy.deliveryAvailable && s.deliveryAvailable).slice(0, 12);
    const states = ["PENDING", "ACCEPTED", "PREPARING", "DISPATCHED"] as const;
    for (let i = 0; i < deliverable.length; i++) {
      const item = deliverable[i];
      await db.order.create({
        data: {
          patientId: pick(allPatients).id,
          pharmacyId: item.pharmacyId,
          fulfilment: "DELIVERY",
          subtotal: item.price,
          deliveryFee: item.pharmacy.deliveryFee,
          serviceFee: 20,
          total: item.price + item.pharmacy.deliveryFee + 20,
          status: states[i % states.length],
          deliveryAddress: "Lenana Rd, Kilimani, Nairobi",
          createdAt: mins(int(5, 120)),
          items: { create: [{ medicineId: item.medicineId, quantity: 1, unitPrice: item.price }] },
        },
      });
      live++;
    }

    // Saved pharmacies, availability alerts, notifications.
    for (const patient of allPatients) {
      for (const ph of [pick(pharmacies), pick(pharmacies)]) {
        await db.savedPharmacy.upsert({
          where: { patientId_pharmacyId: { patientId: patient.id, pharmacyId: ph.id } },
          update: {},
          create: { patientId: patient.id, pharmacyId: ph.id },
        });
      }
      await db.availabilityAlert.create({ data: { patientId: patient.id, medicineId: pick(medicines).id, area: pick(["westlands", "kilimani", "nairobi-cbd", null]) } });
      await db.notification.create({
        data: { userId: patient.id, type: "SYSTEM", title: "Welcome to DawaFind", message: "Search a medicine, compare verified pharmacies, and reserve before you travel.", link: "/search", read: rand() < 0.5, createdAt: hours(int(1, 200)) },
      });
    }

    // Extra search analytics so dashboards look lived-in.
    const searches: Prisma.SearchEventCreateManyInput[] = [];
    for (let i = 0; i < 400; i++) {
      searches.push({
        userId: rand() < 0.4 ? pick(allPatients).id : null,
        query: "seed",
        medicineId: pick(medicines).id,
        area: pick(["westlands", "kilimani", "nairobi-cbd", "kasarani", "nyali", "kisumu", "nakuru", "eldoret", "thika"]),
        resultCount: int(0, 8),
        foundVerifiedAvailable: rand() > 0.12,
        createdAt: hours(int(1, 24 * 30)),
      });
    }
    await db.searchEvent.createMany({ data: searches });
    const impressions: Prisma.PharmacyImpressionCreateManyInput[] = [];
    for (let i = 0; i < 900; i++) {
      impressions.push({
        pharmacyId: pick(pharmacies).id,
        medicineId: rand() < 0.8 ? pick(medicines).id : null,
        kind: rand() < 0.85 ? "SEARCH_APPEARANCE" : "PROFILE_VIEW",
        createdAt: hours(int(1, 24 * 30)),
      });
    }
    await db.pharmacyImpression.createMany({ data: impressions });

    await db.auditLog.create({ data: { userId: admin?.id ?? null, action: "seed.more", entityType: "System", entityId: "seed", metadata: { seeded: true } } });
  }

  const total = {
    medicines: await db.medicine.count(),
    pharmacies: await db.pharmacy.count(),
    inventory: await db.inventoryItem.count(),
    patients: await db.user.count({ where: { role: "PATIENT" } }),
    orders: await db.order.count(),
    reservations: await db.reservation.count(),
  };
  console.log(`Added ${addedMeds} medicines, ${addedPharmacies} pharmacies, ${addedItems} inventory rows, ${orders} past orders and ${live} live requests.`);
  console.log("Totals now:", total);
  console.log(`New pharmacy admins (password "${PASSWORD}"): ${NEW_PHARMACIES.map((p) => `${p.key}@dawafind.test`).join(", ")}`);
  console.log(`New patients: ${PATIENTS.map((p) => p[1]).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
