import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrdersPageContent from "./OrdersPageContent";

export default async function OrdersPage() {
  const session = await requireAuth();
  if (session.user.role !== "STUDENT") redirect("/forbidden");

  const orders = await prisma.order.findMany({
    where: { studentId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { menuItem: { select: { name: true } } } },
      pickupSlot: { select: { slotTime: true } },
    },
  });

  const mapped = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    type: o.type,
    status: o.status,
    totalAmount: Number(o.totalAmount),
    qrCode: o.qrCode,
    pickupSlot: o.pickupSlot ? { slotTime: o.pickupSlot.slotTime } : null,
    items: o.items.map((oi) => ({
      menuItemName: oi.menuItem.name,
      quantity: oi.quantity,
      unitPrice: Number(oi.unitPrice),
      subtotal: Number(oi.subtotal),
    })),
    createdAt: o.createdAt.toISOString(),
  }));

  return <OrdersPageContent orders={mapped} />;
}
