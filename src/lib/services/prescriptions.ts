import type { PrescriptionStatus } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { notify, notifyPharmacy } from "../notify";
import { badRequest, notFound } from "../http";
import {
  MAX_UPLOAD_BYTES,
  readDecrypted,
  saveEncrypted,
  screenForActiveContent,
  secureDelete,
  sniffMime,
} from "../storage";
import { getSettings } from "./settings";

export async function uploadPrescription(
  patientId: string,
  file: Buffer,
  opts: { pharmacyId?: string | null; consent: boolean },
) {
  if (!opts.consent) throw badRequest("Please give consent for DawaFind to store your prescription before uploading.");
  if (file.length === 0) throw badRequest("The file is empty.");
  if (file.length > MAX_UPLOAD_BYTES) throw badRequest("The file is too large. The maximum size is 5 MB.");
  const mime = sniffMime(file);
  if (!mime) throw badRequest("Unsupported file type. Please upload a PDF, JPG or PNG.");
  screenForActiveContent(file, mime);

  if (opts.pharmacyId) {
    const p = await db.pharmacy.findUnique({ where: { id: opts.pharmacyId }, select: { verificationStatus: true } });
    if (!p || p.verificationStatus !== "VERIFIED") throw badRequest("Please choose a verified pharmacy.");
  }

  const settings = await getSettings();
  const ref = await saveEncrypted(file);
  const rx = await db.prescription.create({
    data: {
      patientId,
      pharmacyId: opts.pharmacyId || null,
      fileReference: ref,
      mimeType: mime,
      sizeBytes: file.length,
      expiresAt: new Date(Date.now() + settings.prescriptionRetentionDays * 86_400_000),
    },
  });
  await db.patientProfile.upsert({
    where: { userId: patientId },
    update: { healthDataConsentAt: new Date() },
    create: { userId: patientId, healthDataConsentAt: new Date() },
  });
  // Metadata only — never the file contents.
  await audit(patientId, "prescription.upload", "Prescription", rx.id, { mime, sizeBytes: file.length, shared: !!opts.pharmacyId });
  if (opts.pharmacyId) await notifyShared(opts.pharmacyId);
  return rx;
}

const notifyShared = (pharmacyId: string) =>
  notifyPharmacy(pharmacyId, {
    type: "PRESCRIPTION_UPDATE",
    title: "New prescription received",
    message: "A patient shared a prescription with your pharmacy for review by a pharmacy professional.",
    link: "/pharmacy/prescriptions",
  });

export async function sharePrescription(patientId: string, id: string, pharmacyId: string) {
  const rx = await db.prescription.findUnique({ where: { id } });
  if (!rx || rx.patientId !== patientId || rx.deletedAt) throw notFound("Prescription not found.");
  if (rx.status === "UNDER_REVIEW" || rx.status === "VERIFIED_BY_PHARMACY" || rx.status === "COMPLETED") {
    throw badRequest("This prescription is already being handled by a pharmacy.");
  }
  const p = await db.pharmacy.findUnique({ where: { id: pharmacyId }, select: { verificationStatus: true } });
  if (!p || p.verificationStatus !== "VERIFIED") throw badRequest("Please choose a verified pharmacy.");
  const updated = await db.prescription.update({
    where: { id },
    data: { pharmacyId, status: "UPLOADED", reviewNote: null },
  });
  await audit(patientId, "prescription.share", "Prescription", id, { pharmacyId });
  await notifyShared(pharmacyId);
  return updated;
}

export type PrescriptionViewer =
  | { kind: "patient"; userId: string }
  | { kind: "pharmacy"; userId: string; pharmacyId: string };

/** Authorised read. Returns 404 for anyone who isn't the owner or the pharmacy the patient shared it with. */
export async function openPrescriptionFile(viewer: PrescriptionViewer, id: string) {
  const rx = await db.prescription.findUnique({ where: { id }, include: { pharmacy: { select: { verificationStatus: true } } } });
  if (!rx || rx.deletedAt) throw notFound("Prescription not found.");
  const allowed =
    viewer.kind === "patient"
      ? rx.patientId === viewer.userId
      : rx.pharmacyId === viewer.pharmacyId && rx.pharmacy?.verificationStatus === "VERIFIED";
  if (!allowed) throw notFound("Prescription not found.");
  const data = await readDecrypted(rx.fileReference);
  await audit(viewer.userId, "prescription.access", "Prescription", id, { as: viewer.kind });
  return { data, mimeType: rx.mimeType };
}

const PHARMACY_TRANSITIONS: Record<string, { from: PrescriptionStatus[]; to: PrescriptionStatus }> = {
  start_review: { from: ["UPLOADED"], to: "UNDER_REVIEW" },
  verify: { from: ["UNDER_REVIEW"], to: "VERIFIED_BY_PHARMACY" },
  reject: { from: ["UNDER_REVIEW"], to: "REJECTED" },
  complete: { from: ["VERIFIED_BY_PHARMACY"], to: "COMPLETED" },
};

export async function updatePrescriptionAsPharmacy(
  userId: string,
  pharmacyId: string,
  id: string,
  input: { action: "start_review" | "verify" | "reject" | "complete"; note?: string },
) {
  const rx = await db.prescription.findUnique({ where: { id } });
  if (!rx || rx.pharmacyId !== pharmacyId || rx.deletedAt) throw notFound("Prescription not found.");
  const t = PHARMACY_TRANSITIONS[input.action];
  if (!t.from.includes(rx.status)) throw badRequest("That action isn't available for this prescription's current status.");
  const updated = await db.prescription.update({
    where: { id },
    data: { status: t.to, reviewNote: input.note ?? rx.reviewNote, reviewedById: userId },
  });
  await audit(userId, `prescription.${input.action}`, "Prescription", id, { pharmacyId });
  await notify(rx.patientId, {
    type: "PRESCRIPTION_UPDATE",
    title: "Prescription update",
    message: `Your pharmacy updated your prescription status to “${t.to.replaceAll("_", " ").toLowerCase()}”.${input.note ? ` Note: ${input.note}` : ""}`,
    link: "/dashboard/prescriptions",
  });
  return updated;
}

/** Patient-initiated secure deletion (file overwritten, record retained as a tombstone without the file). */
export async function deletePrescription(patientId: string, id: string) {
  const rx = await db.prescription.findUnique({ where: { id } });
  if (!rx || rx.patientId !== patientId || rx.deletedAt) throw notFound("Prescription not found.");
  await secureDelete(rx.fileReference);
  await db.prescription.update({ where: { id }, data: { deletedAt: new Date(), status: "EXPIRED", pharmacyId: null } });
  await audit(patientId, "prescription.delete", "Prescription", id);
}
