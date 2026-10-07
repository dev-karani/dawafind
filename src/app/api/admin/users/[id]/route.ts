import type { NextRequest } from "next/server";
import { badRequest, notFound, parseBody, route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { adminUserPatchSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

export const PATCH = route<{ id: string }>(async (req: NextRequest, { params }) => {
  const admin = await requireApi(["PLATFORM_ADMIN"]);
  const { action, reason } = await parseBody(req, adminUserPatchSchema);
  const user = await db.user.findUnique({ where: { id: params.id } });
  if (!user || user.status === "DELETED") throw notFound("User not found.");
  if (user.id === admin.id || user.role === "PLATFORM_ADMIN") throw badRequest("Platform administrator accounts can't be suspended here.");

  if (action === "suspend") {
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
  } else {
    await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
  }
  await audit(admin.id, `user.${action}`, "User", user.id, { reason: reason ?? null });
  return { ok: true };
});
