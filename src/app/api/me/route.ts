import type { NextRequest } from "next/server";
import { parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { profileSettingsSchema } from "@/lib/schemas";
import { areaByKey } from "@/lib/areas";
import { badRequest } from "@/lib/http";

export const PATCH = route(async (req: NextRequest) => {
  const me = await requireApi();
  const input = await parseBody(req, profileSettingsSchema);
  if (input.defaultArea && !areaByKey(input.defaultArea)) throw badRequest("Unknown area.");
  await db.user.update({
    where: { id: me.id },
    data: { fullName: input.fullName, phone: input.phone === undefined ? undefined : input.phone },
  });
  if (me.role === "PATIENT" && (input.defaultArea !== undefined || input.emailNotifications !== undefined)) {
    await db.patientProfile.upsert({
      where: { userId: me.id },
      update: { defaultArea: input.defaultArea, emailNotifications: input.emailNotifications },
      create: { userId: me.id, defaultArea: input.defaultArea, emailNotifications: input.emailNotifications ?? true },
    });
  }
  return { ok: true };
});
