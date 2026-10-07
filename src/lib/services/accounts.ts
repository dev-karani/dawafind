import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../audit";
import { sendMail } from "../mail";
import { notify } from "../notify";
import { conflict } from "../http";
import { hashPassword } from "../auth/password";
import { sha256 } from "../auth/session";
import { registerSchema } from "../schemas";
import { defaultHours } from "../hours";

type RegisterInput = z.infer<typeof registerSchema>;

export const PLANS = {
  BASIC: { monthlyFee: 0, features: "Listing, inventory, reservations" },
  GROWTH: { monthlyFee: 3500, features: "Analytics, priority labelled visibility, advanced reports" },
  ENTERPRISE: { monthlyFee: 15000, features: "Multiple branches, API access, stock synchronisation" },
} as const;

export async function registerAccount(input: RegisterInput) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with this email already exists. Try signing in instead.");
  const passwordHash = await hashPassword(input.password);

  if (input.type === "patient") {
    const user = await db.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        role: "PATIENT",
        patientProfile: { create: {} },
      },
    });
    await audit(user.id, "user.register", "User", user.id, { role: "PATIENT" });
    return user;
  }

  const { pharmacy } = input;
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { fullName: input.fullName, email: input.email, phone: input.phone, passwordHash, role: "PHARMACY_ADMIN" },
    });
    const ph = await tx.pharmacy.create({
      data: {
        name: pharmacy.name,
        address: pharmacy.address,
        area: pharmacy.area,
        town: pharmacy.town,
        latitude: pharmacy.latitude,
        longitude: pharmacy.longitude,
        phone: pharmacy.phone,
        email: pharmacy.email,
        licenseReference: pharmacy.licenseReference,
        responsiblePharmacist: pharmacy.responsiblePharmacist,
        businessInfo: pharmacy.businessInfo,
        openingHours: defaultHours() as Prisma.InputJsonValue,
        verificationStatus: "PENDING",
        staff: { create: { userId: u.id, role: "PHARMACY_ADMIN" } },
        plans: { create: { planName: "BASIC", monthlyFee: PLANS.BASIC.monthlyFee } },
      },
    });
    await audit(u.id, "pharmacy.register", "Pharmacy", ph.id, { licenseReference: pharmacy.licenseReference }, tx);
    return u;
  }, { timeout: 20_000, maxWait: 10_000 });
  const admins = await db.user.findMany({ where: { role: "PLATFORM_ADMIN", status: "ACTIVE" }, select: { id: true } });
  await Promise.all(
    admins.map((a) =>
      notify(a.id, {
        type: "SYSTEM",
        title: "New pharmacy awaiting verification",
        message: `${pharmacy.name} (${pharmacy.area}) submitted a registration for review.`,
        link: "/admin/pharmacies?status=PENDING",
      }),
    ),
  );
  return user;
}

export async function createResetToken(userId: string, hours: number) {
  const token = randomBytes(32).toString("base64url");
  await db.passwordResetToken.create({
    data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + hours * 3600_000) },
  });
  return token;
}

export async function sendResetEmail(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  // Always behave identically to the caller, whether or not the account exists.
  if (!user || user.status !== "ACTIVE") return;
  const token = await createResetToken(user.id, 1);
  const base = process.env.APP_URL || "http://localhost:3000";
  await sendMail(
    user.email,
    "Reset your DawaFind password",
    `Use this link within one hour to choose a new password:\n${base}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
  );
}
