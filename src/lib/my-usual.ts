import { prisma } from "./prisma";

export interface MyUsualCombo {
  id: string;
  label: string;
  items: {
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  totalPrice: number;
  orderCount: number;
}

/**
 * Get the student's top 3 most frequently ordered item combinations
 * from the last 14 days. Uses a sorted item:quantity signature to detect
 * repeated combinations regardless of add order.
 */
export async function getMyUsual(userId: string): Promise<MyUsualCombo[]> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const orders = await prisma.order.findMany({
    where: {
      studentId: userId,
      createdAt: { gte: fourteenDaysAgo },
    },
    include: {
      items: {
        include: {
          menuItem: {
            select: { id: true, name: true, basePrice: true, isActive: true, dietaryType: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (orders.length === 0) return [];

  // Group by sorted item:quantity signature
  const comboMap = new Map<
    string,
    {
      items: (typeof orders)[0]["items"];
      count: number;
    }
  >();

  for (const order of orders) {
    // Skip orders where any item is now inactive
    const allActive = order.items.every((oi) => oi.menuItem.isActive);
    if (!allActive) continue;

    const signature = order.items
      .map((oi) => `${oi.menuItemId}:${oi.quantity}`)
      .sort()
      .join("|");

    const existing = comboMap.get(signature);
    if (existing) {
      existing.count++;
    } else {
      comboMap.set(signature, { items: order.items, count: 1 });
    }
  }

  // Top 3 by count
  return [...comboMap.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 3)
    .map(([sig, val]) => {
      const label = val.items.map((oi) => oi.menuItem.name).join(" + ");
      const items = val.items.map((oi) => ({
        menuItemId: oi.menuItemId,
        name: oi.menuItem.name,
        quantity: oi.quantity,
        price: Number(oi.menuItem.basePrice),
      }));
      const totalPrice = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

      return { id: sig, label, items, totalPrice, orderCount: val.count };
    });
}
