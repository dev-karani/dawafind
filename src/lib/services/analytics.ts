import { db } from "../db";
import { medicineLabel } from "../medicine";

const startOfTodayNairobi = () => {
  // Africa/Nairobi is UTC+3 with no DST.
  const now = new Date();
  const local = new Date(now.getTime() + 3 * 3600_000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - 3 * 3600_000);
};

export async function pharmacyOverview(pharmacyId: string) {
  const today = startOfTodayNairobi();
  const staleCutoff = new Date(Date.now() - 24 * 3600_000);
  const [searchesToday, pendingReservations, pendingConfirmations, openOrders, outOfStock, limited, stale, revenue] =
    await Promise.all([
      db.pharmacyImpression.count({ where: { pharmacyId, kind: "SEARCH_APPEARANCE", createdAt: { gte: today } } }),
      db.reservation.count({ where: { pharmacyId, status: "PENDING" } }),
      db.stockConfirmation.count({ where: { pharmacyId, status: "PENDING", expiresAt: { gt: new Date() } } }),
      db.order.count({ where: { pharmacyId, status: { in: ["PENDING", "ACCEPTED", "PREPARING", "DISPATCHED"] } } }),
      db.inventoryItem.count({ where: { pharmacyId, stockStatus: "OUT_OF_STOCK" } }),
      db.inventoryItem.count({ where: { pharmacyId, stockStatus: "LIMITED" } }),
      db.inventoryItem.count({ where: { pharmacyId, lastStockUpdate: { lt: staleCutoff }, stockStatus: { not: "OUT_OF_STOCK" } } }),
      db.order.aggregate({
        _sum: { subtotal: true, deliveryFee: true },
        where: { pharmacyId, status: "COMPLETED", completedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      }),
    ]);
  return {
    searchesToday,
    pendingReservations,
    pendingConfirmations,
    openOrders,
    inventoryAlerts: { outOfStock, limited, stale },
    revenue30d: (revenue._sum.subtotal ?? 0) + (revenue._sum.deliveryFee ?? 0),
  };
}

export async function pharmacyAnalytics(pharmacyId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [searches, views, reservations, collected, totalOrders, completedOrders, revenue, popular] = await Promise.all([
    db.pharmacyImpression.count({ where: { pharmacyId, kind: "SEARCH_APPEARANCE", createdAt: { gte: since } } }),
    db.pharmacyImpression.count({ where: { pharmacyId, kind: "PROFILE_VIEW", createdAt: { gte: since } } }),
    db.reservation.count({ where: { pharmacyId, createdAt: { gte: since } } }),
    db.reservation.count({ where: { pharmacyId, status: "COLLECTED", createdAt: { gte: since } } }),
    db.order.count({ where: { pharmacyId, createdAt: { gte: since }, reservationId: null } }),
    db.order.count({ where: { pharmacyId, status: "COMPLETED", createdAt: { gte: since } } }),
    db.order.aggregate({
      _sum: { subtotal: true, deliveryFee: true },
      where: { pharmacyId, status: "COMPLETED", createdAt: { gte: since } },
    }),
    db.pharmacyImpression.groupBy({
      by: ["medicineId"],
      where: { pharmacyId, kind: "SEARCH_APPEARANCE", medicineId: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { medicineId: "desc" } },
      take: 5,
    }),
  ]);
  const meds = await db.medicine.findMany({ where: { id: { in: popular.map((p) => p.medicineId!).filter(Boolean) } } });
  const requests = reservations + totalOrders;
  return {
    days,
    searches,
    views,
    reservations,
    collected,
    completedOrders,
    revenue: (revenue._sum.subtotal ?? 0) + (revenue._sum.deliveryFee ?? 0),
    conversionRate: searches > 0 ? requests / searches : 0,
    popular: popular.map((p) => {
      const m = meds.find((x) => x.id === p.medicineId);
      return { medicine: m ? medicineLabel(m) : "Unknown", appearances: p._count._all };
    }),
  };
}

export async function platformOverview() {
  const [users, patients, pharmacies, verified, pending, listings, reservations, orders, fees, gmv] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "PATIENT" } }),
    db.pharmacy.count(),
    db.pharmacy.count({ where: { verificationStatus: "VERIFIED" } }),
    db.pharmacy.count({ where: { verificationStatus: "PENDING" } }),
    db.inventoryItem.count(),
    db.reservation.count(),
    db.order.count(),
    db.order.aggregate({ _sum: { serviceFee: true }, where: { status: "COMPLETED" } }),
    db.order.aggregate({ _sum: { total: true }, where: { status: "COMPLETED" } }),
  ]);
  const plans = await db.pharmacyPlan.aggregate({ _sum: { monthlyFee: true }, where: { status: "ACTIVE" } });
  return {
    users,
    patients,
    pharmacies,
    verified,
    pending,
    listings,
    reservations,
    orders,
    serviceFeeRevenue: fees._sum.serviceFee ?? 0,
    subscriptionRevenueMonthly: plans._sum.monthlyFee ?? 0,
    transactionValue: gmv._sum.total ?? 0,
  };
}

export async function platformReports(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);

  const [activity, demand, searches, successful, inventory] = await Promise.all([
    db.pharmacy.findMany({
      where: { verificationStatus: "VERIFIED" },
      select: {
        id: true,
        name: true,
        area: true,
        _count: { select: { reservations: { where: { createdAt: { gte: since } } }, orders: { where: { createdAt: { gte: since } } } } },
        impressions: { where: { createdAt: { gte: since }, kind: "SEARCH_APPEARANCE" }, select: { id: true } },
        inventory: { select: { lastStockUpdate: true } },
      },
    }),
    db.searchEvent.groupBy({
      by: ["medicineId"],
      where: { createdAt: { gte: since }, medicineId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { medicineId: "desc" } },
      take: 10,
    }),
    db.searchEvent.count({ where: { createdAt: { gte: since }, medicineId: { not: null } } }),
    db.searchEvent.count({ where: { createdAt: { gte: since }, medicineId: { not: null }, foundVerifiedAvailable: true } }),
    db.inventoryItem.findMany({ select: { lastStockUpdate: true, stockStatus: true } }),
  ]);
  const meds = await db.medicine.findMany({ where: { id: { in: demand.map((d) => d.medicineId!) } } });

  const now = Date.now();
  const bucket = { high: 0, medium: 0, low: 0, stale: 0 };
  for (const i of inventory) {
    const mins = (now - i.lastStockUpdate.getTime()) / 60000;
    if (mins <= 60) bucket.high++;
    else if (mins <= 360) bucket.medium++;
    else if (mins <= 1440) bucket.low++;
    else bucket.stale++;
  }
  const avgAgeHours = inventory.length
    ? inventory.reduce((s, i) => s + (now - i.lastStockUpdate.getTime()), 0) / inventory.length / 3600_000
    : 0;

  const revenue = await db.order.aggregate({
    _sum: { serviceFee: true, total: true },
    _count: { _all: true },
    where: { status: "COMPLETED", completedAt: { gte: since } },
  });

  return {
    days,
    pharmacyActivity: activity.map((p) => ({
      name: p.name,
      area: p.area,
      appearances: p.impressions.length,
      reservations: p._count.reservations,
      orders: p._count.orders,
      listings: p.inventory.length,
    })),
    medicineDemand: demand.map((d) => {
      const m = meds.find((x) => x.id === d.medicineId);
      return { medicine: m ? medicineLabel(m) : "Unknown", searches: d._count._all };
    }),
    searchSuccess: { searches, successful, rate: searches ? successful / searches : 0 },
    stockFreshness: { ...bucket, avgAgeHours },
    revenue: {
      completedOrders: revenue._count._all,
      transactionValue: revenue._sum.total ?? 0,
      serviceFees: revenue._sum.serviceFee ?? 0,
    },
  };
}
