import { route } from "@/lib/http";
import { getPharmacyContext, requireApi } from "@/lib/auth/guard";
import { openPrescriptionFile } from "@/lib/services/prescriptions";

/**
 * The only way to read a prescription file: authenticated, authorised, audited.
 * There is no public or signed URL.
 */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireApi(["PATIENT", "PHARMACY_STAFF", "PHARMACY_ADMIN"]);
  let viewer;
  if (me.role === "PATIENT") viewer = { kind: "patient" as const, userId: me.id };
  else {
    const ctx = (await getPharmacyContext(me))!;
    viewer = { kind: "pharmacy" as const, userId: me.id, pharmacyId: ctx.pharmacyId };
  }
  const { data, mimeType } = await openPrescriptionFile(viewer, params.id);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": mimeType === "application/pdf" ? "attachment; filename=prescription.pdf" : "inline",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
});
