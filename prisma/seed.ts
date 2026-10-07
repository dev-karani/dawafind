/**
 * Development seed data. NEVER run against production: all accounts share a known password.
 *   npm run db:reset   (drops and recreates the schema, then seeds)
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultHours } from "../src/lib/hours";
import { deriveStockStatus } from "../src/lib/pricing";

const db = new PrismaClient();
const PASSWORD = "Password123";
const mins = (n: number) => new Date(Date.now() - n * 60_000);
const hours = (n: number) => mins(n * 60);

const MEDICINES: [string, string | null, string, string, string][] = [
  ["Amoxicillin", "Amoxil", "500mg", "Capsules", "Pack of 20"],
  ["Amoxicillin", null, "250mg", "Capsules", "Pack of 20"],
  ["Amoxicillin", null, "250mg/5ml", "Suspension", "100ml bottle"],
  ["Paracetamol", "Panadol", "500mg", "Tablets", "Pack of 24"],
  ["Ibuprofen", "Brufen", "400mg", "Tablets", "Pack of 30"],
  ["Metformin", "Glucophage", "500mg", "Tablets", "Pack of 30"],
  ["Metformin", null, "850mg", "Tablets", "Pack of 30"],
  ["Amlodipine", "Norvasc", "5mg", "Tablets", "Pack of 30"],
  ["Amlodipine", "Norvasc", "10mg", "Tablets", "Pack of 30"],
  ["Losartan", "Cozaar", "50mg", "Tablets", "Pack of 30"],
  ["Atorvastatin", "Lipitor", "20mg", "Tablets", "Pack of 30"],
  ["Omeprazole", "Losec", "20mg", "Capsules", "Pack of 14"],
  ["Ciprofloxacin", "Ciprobay", "500mg", "Tablets", "Pack of 10"],
  ["Azithromycin", "Zithromax", "500mg", "Tablets", "Pack of 3"],
  ["Artemether/Lumefantrine", "Coartem", "20mg/120mg", "Tablets", "Pack of 24"],
  ["Salbutamol", "Ventolin", "100mcg", "Inhaler", "200 doses"],
  ["Cetirizine", "Zyrtec", "10mg", "Tablets", "Pack of 10"],
  ["Doxycycline", null, "100mg", "Capsules", "Pack of 10"],
  ["Prednisolone", null, "5mg", "Tablets", "Pack of 28"],
  ["Hydrochlorothiazide", null, "25mg", "Tablets", "Pack of 28"],
  ["Insulin Glargine", "Lantus", "100IU/ml", "Injection", "10ml vial"],
  ["Oral Rehydration Salts", "ORS", "20.5g", "Sachets", "Pack of 10"],
];

interface PharmacySeed {
  key: string;
  name: string;
  address: string;
  area: string;
  town: string;
  lat: number;
  lng: number;
  phone: string;
  delivery?: { fee: number; eta: number };
  status: "VERIFIED" | "PENDING";
  license: string;
  pharmacist: string;
}

const PHARMACIES: PharmacySeed[] = [
  { key: "abc", name: "ABC Pharmacy", address: "Woodvale Grove, Westlands", area: "Westlands", town: "Nairobi", lat: -1.2688, lng: 36.8102, phone: "+254 700 100 001", delivery: { fee: 100, eta: 45 }, status: "VERIFIED", license: "PPB/PREM/2024/00123", pharmacist: "Dr. Achieng Otieno" },
  { key: "xyz", name: "XYZ Pharmacy", address: "Argwings Kodhek Rd, Kilimani", area: "Kilimani", town: "Nairobi", lat: -1.2915, lng: 36.7875, phone: "+254 700 100 002", delivery: { fee: 100, eta: 60 }, status: "VERIFIED", license: "PPB/PREM/2023/00871", pharmacist: "Dr. Brian Mwangi" },
  { key: "health", name: "Health Pharmacy", address: "Moi Avenue, Nairobi CBD", area: "Nairobi CBD", town: "Nairobi", lat: -1.2849, lng: 36.8231, phone: "+254 700 100 003", delivery: { fee: 50, eta: 30 }, status: "VERIFIED", license: "PPB/PREM/2022/00457", pharmacist: "Dr. Faith Wanjiku" },
  { key: "karen", name: "Karen Care Pharmacy", address: "Karen Rd, Karen", area: "Karen", town: "Nairobi", lat: -1.3188, lng: 36.7092, phone: "+254 700 100 004", status: "VERIFIED", license: "PPB/PREM/2024/00302", pharmacist: "Dr. Samuel Kiptoo" },
  { key: "eastleigh", name: "Eastleigh Chemists", address: "1st Avenue, Eastleigh", area: "Eastleigh", town: "Nairobi", lat: -1.2751, lng: 36.8452, phone: "+254 700 100 005", delivery: { fee: 80, eta: 50 }, status: "VERIFIED", license: "PPB/PREM/2021/00998", pharmacist: "Dr. Halima Yusuf" },
  { key: "nyali", name: "Nyali Pharmacy", address: "Links Rd, Nyali", area: "Nyali", town: "Mombasa", lat: -4.0271, lng: 39.7158, phone: "+254 700 100 006", delivery: { fee: 150, eta: 60 }, status: "VERIFIED", license: "PPB/PREM/2023/00214", pharmacist: "Dr. Omar Salim" },
  { key: "lakeside", name: "Lakeside Pharmacy", address: "Oginga Odinga St, Kisumu", area: "Kisumu Town", town: "Kisumu", lat: -0.0922, lng: 34.7683, phone: "+254 700 100 007", status: "VERIFIED", license: "PPB/PREM/2022/00640", pharmacist: "Dr. Grace Atieno" },
  { key: "newlife", name: "Newlife Chemist", address: "Mombasa Rd, South B", area: "South B", town: "Nairobi", lat: -1.3099, lng: 36.8331, phone: "+254 700 100 008", status: "PENDING", license: "PPB/PREM/2026/00011 (pending PPB check)", pharmacist: "Dr. Peter Njoroge" },
];

/** [pharmacyKey, medicine index, price, minimumPrice, qty, stockAgeMinutes, delivery] */
type Row = [string, number, number, number, number, number, boolean];
const INVENTORY: Row[] = [
  // Amoxicillin 500mg capsules — the headline comparison example
  ["abc", 0, 450, 380, 40, 12, true],
  ["xyz", 0, 420, 350, 25, 180, true],
  ["health", 0, 470, 400, 6, 40, true],
  ["karen", 0, 440, 380, 0, 90, false],
  ["eastleigh", 0, 400, 340, 30, 2900, true],
  ["nyali", 0, 430, 370, 18, 20, true],
  // Amoxicillin 250mg capsules / suspension
  ["abc", 1, 300, 250, 30, 12, true],
  ["xyz", 1, 280, 230, 0, 600, true],
  ["health", 2, 350, 300, 15, 35, true],
  // Paracetamol, ibuprofen
  ["abc", 3, 120, 90, 100, 12, true],
  ["xyz", 3, 110, 85, 80, 180, true],
  ["health", 3, 130, 95, 60, 40, true],
  ["karen", 3, 125, 95, 50, 90, false],
  ["eastleigh", 3, 100, 80, 200, 500, true],
  ["lakeside", 3, 115, 90, 70, 30, false],
  ["abc", 4, 180, 140, 40, 12, true],
  ["health", 4, 170, 135, 25, 40, true],
  // Chronic medicines
  ["abc", 5, 350, 300, 60, 12, true],
  ["xyz", 5, 330, 280, 45, 180, true],
  ["karen", 5, 360, 300, 20, 90, false],
  ["abc", 7, 520, 450, 35, 12, true],
  ["health", 7, 500, 440, 8, 40, true],
  ["xyz", 8, 560, 480, 0, 180, true],
  ["abc", 9, 640, 560, 25, 12, true],
  ["eastleigh", 9, 600, 520, 14, 2900, true],
  ["abc", 10, 780, 680, 30, 12, true],
  ["xyz", 10, 750, 650, 22, 180, true],
  // Antibiotics / malaria
  ["abc", 12, 520, 440, 20, 12, true],
  ["health", 12, 500, 430, 12, 40, true],
  ["abc", 13, 680, 600, 15, 12, true],
  ["abc", 14, 450, 380, 35, 12, true],
  ["xyz", 14, 430, 360, 40, 180, true],
  ["eastleigh", 14, 400, 340, 50, 2900, true],
  ["nyali", 14, 460, 390, 30, 20, true],
  // Asthma / allergy / other
  ["abc", 15, 750, 650, 18, 12, true],
  ["health", 15, 720, 640, 0, 40, true],
  ["abc", 16, 150, 110, 80, 12, true],
  ["abc", 11, 480, 400, 24, 12, true],
  ["xyz", 21, 90, 60, 100, 180, true],
  ["health", 20, 2800, 2500, 5, 40, false],
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production.");
  if ((await db.user.count()) > 0) {
    console.log("Database already has users; run `npm run db:reset` for a clean seed.");
    return;
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await db.platformSetting.create({ data: { id: 1 } });

  const admin = await db.user.create({
    data: { fullName: "Platform Admin", email: "admin@dawafind.test", passwordHash, role: "PLATFORM_ADMIN", phone: "+254 700 000 000" },
  });
  const patient = await db.user.create({
    data: {
      fullName: "Wanjiru Kamau",
      email: "patient@dawafind.test",
      passwordHash,
      role: "PATIENT",
      phone: "+254 711 000 001",
      patientProfile: { create: { defaultArea: "westlands" } },
    },
  });
  await db.user.create({
    data: { fullName: "Otieno Odhiambo", email: "patient2@dawafind.test", passwordHash, role: "PATIENT", patientProfile: { create: {} } },
  });

  const medicines = [];
  for (const [genericName, brandName, strength, dosageForm, packSize] of MEDICINES) {
    medicines.push(await db.medicine.create({ data: { genericName, brandName, strength, dosageForm, packSize } }));
  }

  const pharmacies: Record<string, { id: string }> = {};
  for (const p of PHARMACIES) {
    const user = await db.user.create({
      data: { fullName: p.pharmacist, email: `${p.key}@dawafind.test`, passwordHash, role: "PHARMACY_ADMIN", phone: p.phone },
    });
    const ph = await db.pharmacy.create({
      data: {
        name: p.name,
        address: p.address,
        area: p.area,
        town: p.town,
        latitude: p.lat,
        longitude: p.lng,
        phone: p.phone,
        email: `${p.key}@dawafind.test`,
        openingHours: (p.key === "health" ? Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, { open: "00:00", close: "23:59" }])) : defaultHours()) as Prisma.InputJsonValue,
        deliveryAvailable: !!p.delivery,
        deliveryFee: p.delivery?.fee ?? 0,
        deliveryEtaMinutes: p.delivery?.eta ?? null,
        licenseReference: p.license,
        responsiblePharmacist: p.pharmacist,
        verificationStatus: p.status,
        verifiedAt: p.status === "VERIFIED" ? hours(24 * 30) : null,
        staff: { create: { userId: user.id, role: "PHARMACY_ADMIN" } },
        plans: { create: { planName: p.key === "abc" ? "GROWTH" : "BASIC", monthlyFee: p.key === "abc" ? 3500 : 0 } },
      },
    });
    pharmacies[p.key] = ph;
  }
  const staffUser = await db.user.create({
    data: { fullName: "Mercy Njeri", email: "abc.staff@dawafind.test", passwordHash, role: "PHARMACY_STAFF" },
  });
  await db.pharmacyStaff.create({ data: { userId: staffUser.id, pharmacyId: pharmacies.abc.id, role: "PHARMACY_STAFF" } });

  for (const [key, mi, price, minimumPrice, quantity, age, delivery] of INVENTORY) {
    await db.inventoryItem.create({
      data: {
        pharmacyId: pharmacies[key].id,
        medicineId: medicines[mi].id,
        price,
        minimumPrice,
        quantity,
        stockStatus: deriveStockStatus(quantity),
        lastStockUpdate: mins(age),
        lastPriceUpdate: mins(Math.min(age + 15, 3000)),
        deliveryAvailable: delivery && !!PHARMACIES.find((p) => p.key === key)?.delivery,
      },
    });
  }
  // A DawaFind promotion on ABC's Paracetamol, safely above its 90 floor.
  await db.inventoryItem.updateMany({
    where: { pharmacyId: pharmacies.abc.id, medicineId: medicines[3].id },
    data: { promoPrice: 105, promotionsEnabled: true },
  });

  // ── history for analytics ──
  const impressions: Prisma.PharmacyImpressionCreateManyInput[] = [];
  const keys = Object.keys(pharmacies).filter((k) => k !== "newlife");
  for (let i = 0; i < 400; i++) {
    const key = keys[i % keys.length];
    const mi = [0, 0, 0, 3, 3, 5, 7, 14, 4][i % 9];
    impressions.push({ pharmacyId: pharmacies[key].id, medicineId: medicines[mi].id, kind: "SEARCH_APPEARANCE", createdAt: hours(Math.floor(Math.random() * 24 * 25)) });
  }
  for (let i = 0; i < 90; i++) impressions.push({ pharmacyId: pharmacies[keys[i % keys.length]].id, kind: "PROFILE_VIEW", createdAt: hours(Math.floor(Math.random() * 24 * 25)) });
  await db.pharmacyImpression.createMany({ data: impressions });

  const searches: Prisma.SearchEventCreateManyInput[] = [];
  for (let i = 0; i < 120; i++) {
    searches.push({
      userId: i % 6 === 0 ? patient.id : null,
      query: "seed",
      medicineId: medicines[[0, 3, 5, 7, 14, 0, 4][i % 7]].id,
      area: "westlands",
      resultCount: 3 + (i % 3),
      foundVerifiedAvailable: i % 9 !== 0,
      createdAt: hours(Math.floor(Math.random() * 24 * 25)),
    });
  }
  await db.searchEvent.createMany({ data: searches });

  // A few completed orders (collections) at ABC and XYZ to power revenue figures.
  for (let i = 0; i < 6; i++) {
    const mi = [0, 3, 5][i % 3];
    const item = INVENTORY.find((r) => r[0] === "abc" && r[1] === mi)!;
    const qty = 1 + (i % 2);
    await db.order.create({
      data: {
        patientId: patient.id,
        pharmacyId: pharmacies.abc.id,
        fulfilment: "PICKUP",
        subtotal: item[2] * qty,
        serviceFee: 20,
        total: item[2] * qty + 20,
        status: "COMPLETED",
        paymentStatus: "PAID",
        completedAt: hours(24 * (i + 1)),
        createdAt: hours(24 * (i + 1)),
        items: { create: [{ medicineId: medicines[mi].id, quantity: qty, unitPrice: item[2] }] },
      },
    });
  }

  // Live requests so the pharmacy dashboard has something to act on.
  await db.reservation.create({
    data: {
      patientId: patient.id,
      pharmacyId: pharmacies.abc.id,
      medicineId: medicines[0].id,
      quantity: 1,
      unitPrice: 450,
      serviceFee: 20,
      totalPrice: 470,
      expiresAt: new Date(Date.now() + 90 * 60_000),
    },
  });
  await db.stockConfirmation.create({
    data: {
      patientId: patient.id,
      pharmacyId: pharmacies.abc.id,
      medicineId: medicines[7].id,
      requestedQuantity: 1,
      expiresAt: new Date(Date.now() + 100 * 60_000),
    },
  });
  await db.availabilityAlert.create({ data: { patientId: patient.id, medicineId: medicines[8].id, area: "kilimani" } });
  await db.notification.create({
    data: { userId: admin.id, type: "SYSTEM", title: "New pharmacy awaiting verification", message: "Newlife Chemist (South B) submitted a registration for review.", link: "/admin/pharmacies?status=PENDING" },
  });
  await db.auditLog.create({ data: { userId: admin.id, action: "pharmacy.verify", entityType: "Pharmacy", entityId: pharmacies.abc.id, metadata: { seeded: true } } });

  console.log(`Seeded. All demo accounts use the password "${PASSWORD}":
  admin@dawafind.test        platform admin
  patient@dawafind.test      patient
  abc@dawafind.test          pharmacy admin (ABC Pharmacy)
  abc.staff@dawafind.test    pharmacy staff (ABC Pharmacy)
  newlife@dawafind.test      pharmacy admin awaiting verification
  xyz@ / health@ / karen@ / eastleigh@ / nyali@ / lakeside@dawafind.test  other pharmacies`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
