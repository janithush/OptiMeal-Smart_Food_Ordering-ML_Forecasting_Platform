import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureTodaysSlots, toDisplayLabel } from "@/lib/slots";
import { getOrderMode } from "@/lib/order-mode";
import { getOrCreateWallet } from "@/lib/wallet";
import type { MenuItemData, PickupSlotData, DietaryType } from "@/types/menu";
import type { OrderMode } from "@/lib/order-mode";
import MenuPageContent from "./MenuPageContent";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default async function StudentHomePage() {
  const session = await requireAuth();

  if (session.user.role !== "STUDENT") {
    redirect("/forbidden");
  }

  // Onboarding guard
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingDone: true, dietaryPreference: true, allergies: true, name: true },
  });

  if (!user || !user.onboardingDone) {
    redirect("/student/onboarding");
  }

  // ═══ Story 3.2: Ensure today's slots exist ═══════════════════════
  const rawSlots = await ensureTodaysSlots();
  const slots: PickupSlotData[] = rawSlots.map((s) => ({
    id: s.id,
    slotTime: s.slotTime,
    displayLabel: toDisplayLabel(s.slotTime),
    maxCapacity: s.maxCapacity,
    currentCount: s.currentCount,
  }));

  // ═══ Story 3.2: Detect pre-order vs walk-in mode ═════════════════
  const orderMode: OrderMode = getOrderMode();

  // ═══ Story 4.1: Wallet balance ═════════════════════════════
  const { balance: walletBalance } = await getOrCreateWallet(session.user.id);

  // ─── Query today's menu ──────────────────────────────────────────
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const menuItems = await prisma.menuItem.findMany({
    where: { isActive: true },
    include: {
      ingredients: { include: { ingredient: { select: { name: true, unit: true } } } },
      dailySpecials: { where: { date: { gte: todayStart, lte: todayEnd } } },
      orderItems: {
        where: { order: { createdAt: { gte: todayStart, lte: todayEnd } } },
        select: { quantity: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // ─── Compute availability per item ───────────────────────────────
  const MAX_PER_ITEM = 100;
  const items: MenuItemData[] = menuItems.map((item) => {
    const totalOrdered = item.orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
    const pct = totalOrdered / MAX_PER_ITEM;
    const availability = pct >= 0.9 ? "Sold Out" as const : pct >= 0.6 ? "Selling Fast" as const : "Available" as const;

    const specialToday = item.dailySpecials[0];
    const specialPrice = specialToday ? Number(specialToday.specialPrice) : null;

    const ingredientNames = item.ingredients.map((mi) => ({
      name: mi.ingredient.name,
      unit: mi.ingredient.unit,
    }));

    const allergenMatch = user.allergies
      .filter((a) => a !== "None")
      .filter((a) => ingredientNames.some((ing) => ing.name.toLowerCase().includes(a.toLowerCase())));

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      basePrice: Number(item.basePrice),
      dietaryType: item.dietaryType as DietaryType,
      imageUrl: item.imageUrl,
      specialPrice,
      availability,
      ingredients: ingredientNames,
      allergenMatch,
      totalOrdered,
    };
  });

  return (
    <MenuPageContent
      userName={user.name ?? session.user.name ?? "Student"}
      items={items}
      walletBalance={walletBalance}
      slots={slots}
      userDietary={user.dietaryPreference as DietaryType | null}
      orderMode={orderMode}
    />
  );
}
