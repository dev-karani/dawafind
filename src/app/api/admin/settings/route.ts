import type { NextRequest } from "next/server";
import { parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { platformSettingsSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/services/settings";

export const PATCH = route(async (req: NextRequest) => {
  const admin = await requireApi(["PLATFORM_ADMIN"]);
  const input = await parseBody(req, platformSettingsSchema);
  const before = await getSettings();
  const settings = await db.platformSetting.update({ where: { id: 1 }, data: input });
  await audit(admin.id, "platform.settings_update", "PlatformSetting", "1", { before, after: settings });
  return { settings };
});
