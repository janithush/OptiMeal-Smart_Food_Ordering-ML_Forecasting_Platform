import { prisma } from "./prisma";
import type { DietaryPreference } from "@prisma/client";

export interface RecommendedItem {
  menuItemId: string;
  name: string;
  basePrice: number;
  dietaryType: DietaryPreference;
  imageUrl: string | null;
  reason: string;
}

/**
 * Get up to 3 personalised menu recommendations for a student using
 * user-based collaborative filtering.
 *
 * Algorithm (v1):
 * 1. Find the user's dietary preference and order history
 * 2. Find "similar students" — those sharing the same dietary preference
 * 3. Score items by how many similar students have ordered them
 * 4. Exclude items the user already ordered, inactive items, and cross-dietary items
 * 5. Fall back to popular items if no similar-student signal exists
 */
export async function getRecommendations(
  userId: string,
  dietaryPreference: DietaryPreference
): Promise<RecommendedItem[]> {
  // ─── Step 1: Get user's order history ────────────────────────
  const userOrders = await prisma.order.findMany({
    where: { studentId: userId },
    select: {
      items: { select: { menuItemId: true } },
    },
  });

  const orderedItemIds = new Set(
    userOrders.flatMap((o) => o.items.map((oi) => oi.menuItemId))
  );

  // ─── Step 2: Find similar students ───────────────────────────
  const similarStudents = await prisma.user.findMany({
    where: {
      id: { not: userId },
      role: "STUDENT",
      dietaryPreference,
    },
    select: { id: true, department: true },
    take: 50, // Bound for performance
  });

  if (similarStudents.length === 0) {
    // No similar students — fall back to popular items
    const popular = await getPopularRecommendations(orderedItemIds, dietaryPreference);
    if (popular.length > 0) return popular;
    // Final fallback: any active items, dietary-agnostic
    return getExploreRecommendations(orderedItemIds);
  }

  const similarStudentIds = similarStudents.map((s) => s.id);

  // ─── Step 3: Score items by co-occurrence ────────────────────
  const similarOrders = await prisma.order.findMany({
    where: { studentId: { in: similarStudentIds } },
    select: {
      items: {
        select: {
          menuItemId: true,
          menuItem: {
            select: {
              id: true,
              name: true,
              basePrice: true,
              dietaryType: true,
              imageUrl: true,
              isActive: true,
            },
          },
        },
      },
    },
    take: 200, // Bound for performance
  });

  // Score: count distinct similar students who ordered each item
  const itemScores = new Map<
    string,
    {
      name: string;
      basePrice: number;
      dietaryType: DietaryPreference;
      imageUrl: string | null;
      score: number;
      departments: Set<string>;
    }
  >();

  for (const order of similarOrders) {
    // Find the student who placed this order
    const student = similarStudents.find((s) => s.id === order.items[0]?.menuItem?.id ? false : false);
    // We'll track per-order counting instead

    const scoredInThisOrder = new Set<string>();

    for (const oi of order.items) {
      const item = oi.menuItem;

      // Skip inactive, wrong dietary, or already-ordered items
      if (!item.isActive) continue;
      if (item.dietaryType !== dietaryPreference) continue;
      if (orderedItemIds.has(item.id)) continue;
      if (scoredInThisOrder.has(item.id)) continue; // Dedupe within same order
      scoredInThisOrder.add(item.id);

      const existing = itemScores.get(item.id);
      if (existing) {
        existing.score += 1;
      } else {
        itemScores.set(item.id, {
          name: item.name,
          basePrice: Number(item.basePrice),
          dietaryType: item.dietaryType,
          imageUrl: item.imageUrl,
          score: 1,
          departments: new Set(),
        });
      }
    }
  }

  // ─── Step 4: Sort and return top 3 ────────────────────────────
  const sorted = [...itemScores.entries()]
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 3);

  if (sorted.length === 0) {
    const popular = await getPopularRecommendations(orderedItemIds, dietaryPreference);
    if (popular.length > 0) return popular;
    return getExploreRecommendations(orderedItemIds);
  }

  return sorted.map(([menuItemId, data]) => ({
    menuItemId,
    name: data.name,
    basePrice: data.basePrice,
    dietaryType: data.dietaryType,
    imageUrl: data.imageUrl,
    reason:
      data.score >= 5
        ? "Popular among peers"
        : data.score >= 3
          ? "Frequently ordered"
          : "Trending",
  }));
}

/**
 * Fallback: recommend the most popular active menu items matching
 * the dietary preference that the user hasn't ordered yet.
 */
async function getPopularRecommendations(
  excludedItemIds: Set<string>,
  dietaryPreference: DietaryPreference
): Promise<RecommendedItem[]> {
  // Get all active items matching dietary, excluding already-ordered
  const items = await prisma.menuItem.findMany({
    where: {
      isActive: true,
      dietaryType: dietaryPreference,
      ...(excludedItemIds.size > 0
        ? { id: { notIn: [...excludedItemIds] } }
        : {}),
    },
    include: {
      orderItems: {
        select: { quantity: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Sort by total orders (popularity) descending
  const scored = items
    .map((item) => ({
      menuItemId: item.id,
      name: item.name,
      basePrice: Number(item.basePrice),
      dietaryType: item.dietaryType,
      imageUrl: item.imageUrl,
      totalOrdered: item.orderItems.reduce((sum, oi) => sum + oi.quantity, 0),
    }))
    .sort((a, b) => b.totalOrdered - a.totalOrdered)
    .slice(0, 3);

  if (scored.length === 0) return [];

  return scored.map((item) => ({
    menuItemId: item.menuItemId,
    name: item.name,
    basePrice: item.basePrice,
    dietaryType: item.dietaryType,
    imageUrl: item.imageUrl,
    reason: item.totalOrdered > 0 ? "Popular choice" : "Try something new",
  }));
}

/**
 * Last-resort fallback: recommend any active items the user hasn't ordered,
 * regardless of dietary preference. Used when no dietary-matched options exist.
 */
async function getExploreRecommendations(
  excludedItemIds: Set<string>
): Promise<RecommendedItem[]> {
  const items = await prisma.menuItem.findMany({
    where: {
      isActive: true,
      ...(excludedItemIds.size > 0
        ? { id: { notIn: [...excludedItemIds] } }
        : {}),
    },
    take: 3,
    orderBy: { name: "asc" },
  });

  return items.map((item) => ({
    menuItemId: item.id,
    name: item.name,
    basePrice: Number(item.basePrice),
    dietaryType: item.dietaryType,
    imageUrl: item.imageUrl,
    reason: "You might like",
  }));
}
