import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { route, parseBody, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { suggestMedicines } from "@/lib/scanMatch";

const schema = z.object({ text: z.string().max(4000) });

/**
 * Receives only the *text* the user reviewed after on-device reading — never the photo — and returns possible
 * catalogue matches. Nothing is stored or logged here; the text may contain health information.
 */
export const POST = route(async (req: NextRequest) => {
  rateLimit(`scan:${clientIp(req)}`, 30, 60_000);
  const { text } = await parseBody(req, schema);
  if (text.trim().length < 4) return { suggestions: [] };
  const catalogue = await db.medicine.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, genericName: true, brandName: true, strength: true, dosageForm: true, packSize: true },
  });
  return { suggestions: suggestMedicines(text, catalogue) };
});
