import type { Prisma } from "@prisma/client";
import { db, type Db } from "./db";

/**
 * Append-only audit trail. Never put prescription contents or secrets in `metadata`.
 */
export async function audit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue,
  client: Db = db,
) {
  await client.auditLog.create({
    data: { userId, action, entityType, entityId: entityId ?? null, metadata: metadata ?? undefined },
  });
}
