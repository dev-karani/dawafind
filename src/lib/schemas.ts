import { z } from "zod";
import { passwordSchema } from "./auth/password";
import { DAYS } from "./hours";

const text = (max = 200) => z.string().trim().min(1, "Required.").max(max);
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number.");

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
export const openingHoursSchema = z.object(
  Object.fromEntries(
    DAYS.map((d) => [d, z.object({ open: hhmm, close: hhmm }).nullable().optional()]),
  ) as Record<(typeof DAYS)[number], z.ZodOptional<z.ZodNullable<z.ZodObject<{ open: z.ZodString; close: z.ZodString }>>>>,
);

export const pharmacyDetailsSchema = z.object({
  name: text(120),
  address: text(250),
  area: text(80),
  town: text(80),
  latitude: z.coerce.number().min(-5).max(5.5),
  longitude: z.coerce.number().min(33).max(42),
  phone: phoneSchema,
  email: emailSchema,
});

export const registerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("patient"),
    fullName: text(120),
    email: emailSchema,
    phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
    password: passwordSchema,
  }),
  z.object({
    type: z.literal("pharmacy"),
    fullName: text(120),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    pharmacy: pharmacyDetailsSchema.extend({
      licenseReference: text(80),
      responsiblePharmacist: text(120),
      businessInfo: optionalText(1000),
    }),
  }),
]);

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });

const cuid = z.string().min(10).max(40);

export const inventoryCreateSchema = z.object({
  medicineId: cuid,
  quantity: z.coerce.number().int().min(0).max(100000),
  price: z.coerce.number().int().min(1).max(1_000_000),
  minimumPrice: z.coerce.number().int().min(1).max(1_000_000),
  promoPrice: z.coerce.number().int().min(1).max(1_000_000).nullish(),
  promotionsEnabled: z.boolean().optional(),
  deliveryAvailable: z.boolean().optional(),
});

export const inventoryPatchSchema = z
  .object({
    quantity: z.coerce.number().int().min(0).max(100000),
    price: z.coerce.number().int().min(1).max(1_000_000),
    minimumPrice: z.coerce.number().int().min(1).max(1_000_000),
    promoPrice: z.coerce.number().int().min(1).max(1_000_000).nullable(),
    promotionsEnabled: z.boolean(),
    deliveryAvailable: z.boolean(),
    markOutOfStock: z.boolean(),
    refresh: z.boolean(),
  })
  .partial();

export const confirmationCreateSchema = z.object({
  pharmacyId: cuid,
  medicineId: cuid,
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

export const confirmationPatchSchema = z.object({
  action: z.enum(["confirm", "unavailable"]),
  response: optionalText(300),
  markOutOfStock: z.boolean().optional(),
});

export const reservationCreateSchema = z.object({
  pharmacyId: cuid,
  medicineId: cuid,
  quantity: z.coerce.number().int().min(1).max(100),
  note: optionalText(300),
});

export const reservationPatchSchema = z.object({
  action: z.enum(["confirm", "reject", "collect", "expire", "cancel"]),
  holdHours: z.coerce.number().int().min(1).max(72).optional(),
  reason: optionalText(300),
});

export const orderCreateSchema = z.object({
  pharmacyId: cuid,
  medicineId: cuid,
  quantity: z.coerce.number().int().min(1).max(100),
  deliveryAddress: text(300),
  note: optionalText(300),
});

export const orderPatchSchema = z.object({
  action: z.enum(["accept", "prepare", "dispatch", "complete", "cancel"]),
  reason: optionalText(300),
});

export const prescriptionPatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("share"), pharmacyId: cuid }),
  z.object({ action: z.enum(["start_review", "verify", "reject", "complete"]), note: optionalText(300) }),
]);

export const alertCreateSchema = z.object({ medicineId: cuid, area: z.string().max(60).optional() });

export const searchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  medicineId: z.string().max(40).optional(),
  area: z.string().max(60).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(500).optional(),
  sort: z.enum(["price", "total", "distance", "fresh"]).optional(),
  mode: z.enum(["PICKUP", "DELIVERY"]).optional(),
});

export const pharmacySettingsSchema = z.object({
  address: text(250).optional(),
  area: text(80).optional(),
  town: text(80).optional(),
  latitude: z.coerce.number().min(-5).max(5.5).optional(),
  longitude: z.coerce.number().min(33).max(42).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  openingHours: openingHoursSchema.optional(),
  deliveryAvailable: z.boolean().optional(),
  deliveryFee: z.coerce.number().int().min(0).max(5000).optional(),
  deliveryEtaMinutes: z.coerce.number().int().min(5).max(1440).nullable().optional(),
});

export const staffInviteSchema = z.object({ fullName: text(120), email: emailSchema, role: z.enum(["PHARMACY_STAFF", "PHARMACY_ADMIN"]).default("PHARMACY_STAFF") });
export const staffPatchSchema = z.object({ action: z.enum(["remove"]) });

export const adminVerifySchema = z.object({
  action: z.enum(["verify", "reject", "suspend", "reinstate"]),
  note: optionalText(500),
});
export const adminUserPatchSchema = z.object({ action: z.enum(["suspend", "reactivate"]), reason: optionalText(300) });

export const medicineSchema = z.object({
  genericName: text(120),
  brandName: optionalText(120),
  strength: text(60),
  dosageForm: text(60),
  packSize: text(60),
  description: optionalText(500),
});
export const medicinePatchSchema = medicineSchema.partial().extend({ status: z.enum(["ACTIVE", "INACTIVE"]).optional() });

export const platformSettingsSchema = z.object({
  serviceFee: z.coerce.number().int().min(0).max(500).optional(),
  stockConfirmationTtlMins: z.coerce.number().int().min(10).max(1440).optional(),
  pendingReservationTtlMins: z.coerce.number().int().min(10).max(1440).optional(),
  prescriptionRetentionDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const profileSettingsSchema = z.object({
  fullName: text(120).optional(),
  phone: phoneSchema.nullable().optional(),
  defaultArea: z.string().max(60).nullable().optional(),
  emailNotifications: z.boolean().optional(),
});

export const planSchema = z.object({
  planName: z.enum(["BASIC", "GROWTH", "ENTERPRISE"]),
});
