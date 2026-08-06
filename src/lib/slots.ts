import { prisma } from "./prisma";

const SLOT_TIMES = ["11:30", "11:45", "12:00", "12:15", "12:30", "12:45", "13:00", "13:15"];

export function toDisplayLabel(slotTime: string): string {
  const [h, m] = slotTime.split(":").map(Number);
  const totalMinutes = h * 60 + m + 15;
  const endH = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const endM = String(totalMinutes % 60).padStart(2, "0");
  return `${slotTime} - ${endH}:${endM}`;
}

/**
 * Ensure today's 8 pickup slots exist (11:30–13:15).
 * Idempotent — checks for existing slots before creating.
 * Returns all today's slots ordered by time.
 */
export async function ensureTodaysSlots() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const existing = await prisma.pickupSlot.findFirst({
    where: { date: { gte: todayStart, lte: todayEnd } },
  });

  if (existing) {
    return prisma.pickupSlot.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      orderBy: { slotTime: "asc" },
    });
  }

  await prisma.pickupSlot.createMany({
    data: SLOT_TIMES.map((slotTime) => ({
      date: todayStart,
      slotTime,
      maxCapacity: 30,
      currentCount: 0,
    })),
  });

  return prisma.pickupSlot.findMany({
    where: { date: { gte: todayStart, lte: todayEnd } },
    orderBy: { slotTime: "asc" },
  });
}
