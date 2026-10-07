import type { NotificationType } from "@prisma/client";
import { db, type Db } from "./db";
import { sendMail } from "./mail";

interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Creates an in-app notification and (where the user allows) an email.
 * Emails deliberately contain no prescription or diagnosis details.
 */
export async function notify(userId: string, input: NotifyInput, client: Db = db) {
  await client.notification.create({ data: { userId, ...input } });
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { email: true, status: true, patientProfile: { select: { emailNotifications: true } } },
  });
  if (!user || user.status !== "ACTIVE") return;
  if (user.patientProfile && !user.patientProfile.emailNotifications) return;
  const base = process.env.APP_URL || "http://localhost:3000";
  void sendMail(user.email, `DawaFind: ${input.title}`, `${input.message}${input.link ? `\n\n${base}${input.link}` : ""}`);
}

/** Notify every active staff member of a pharmacy. */
export async function notifyPharmacy(pharmacyId: string, input: NotifyInput, client: Db = db) {
  const staff = await client.pharmacyStaff.findMany({
    where: { pharmacyId, status: "ACTIVE", user: { status: "ACTIVE" } },
    select: { userId: true },
  });
  await Promise.all(staff.map((s) => notify(s.userId, input, client)));
}
