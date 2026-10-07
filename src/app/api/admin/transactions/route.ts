import { route } from "@/lib/http";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";

export const GET = route(async () => {
  await requireApi(["PLATFORM_ADMIN"]);
  const [reservations, orders] = await Promise.all([
    db.reservation.findMany({
      include: { medicine: true, pharmacy: { select: { name: true } }, patient: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.order.findMany({
      include: { items: { include: { medicine: true } }, pharmacy: { select: { name: true } }, patient: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { reservations, orders };
});
