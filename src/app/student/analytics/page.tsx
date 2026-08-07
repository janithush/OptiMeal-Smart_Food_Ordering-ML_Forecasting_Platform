import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AnalyticsPageContent from "./AnalyticsPageContent";

export default async function AnalyticsPage() {
  const session = await requireAuth();
  if (session.user.role !== "STUDENT") redirect("/forbidden");

  const userId = session.user.id;

  // Week start (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  // Month start
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // 7 days ago
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [weekAgg, monthAgg, orderCounts, topItems, dailyRaw] = await Promise.all([
    prisma.order.aggregate({ where: { studentId: userId, createdAt: { gte: weekStart } }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { studentId: userId, createdAt: { gte: monthStart } }, _sum: { totalAmount: true } }),
    Promise.all([
      prisma.order.count({ where: { studentId: userId, type: "PRE_ORDER" } }),
      prisma.order.count({ where: { studentId: userId, type: "WALK_IN" } }),
      prisma.order.count({ where: { studentId: userId } }),
    ]),
    prisma.$queryRaw<{ name: string; count: bigint }[]>`
      SELECT mi."name", SUM(oi."quantity")::int as count
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "MenuItem" mi ON mi."id" = oi."menuItemId"
      WHERE o."studentId" = ${userId}
      GROUP BY mi."name"
      ORDER BY count DESC
      LIMIT 3
    `,
    prisma.$queryRaw<{ date: Date; total: number }[]>`
      SELECT DATE("createdAt") as date, SUM("totalAmount")::float as total
      FROM "Order"
      WHERE "studentId" = ${userId}
        AND "createdAt" >= ${sevenDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ]);

  const weekTotal = Number(weekAgg._sum.totalAmount ?? 0);
  const monthTotal = Number(monthAgg._sum.totalAmount ?? 0);
  const [preOrderCount, walkInCount, totalOrders] = orderCounts;
  const avgDaily = totalOrders > 0 ? Math.round(monthTotal / totalOrders) : 0;

  const topItemsList = topItems.map((t) => ({ name: t.name, count: Number(t.count) }));

  // Fill 7 chart bars (may include days with 0 spend)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const chartData = last7Days.map((date) => {
    const found = dailyRaw.find((d) => new Date(d.date).toISOString().slice(0, 10) === date);
    return {
      day: new Date(date + "T00:00:00").toLocaleDateString("en-LK", { weekday: "short" }),
      spend: found ? Math.round(found.total) : 0,
    };
  });

  return (
    <AnalyticsPageContent
      weekTotal={weekTotal}
      monthTotal={monthTotal}
      avgDaily={avgDaily}
      totalOrders={totalOrders}
      preOrderCount={preOrderCount}
      walkInCount={walkInCount}
      topItems={topItemsList}
      chartData={chartData}
    />
  );
}
