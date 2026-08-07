import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { emitOrderStatusUpdate, emitDashboardRefresh } from "@/lib/order-events";

/**
 * POST /api/admin/orders/scan — QR code scan for order collection
 * Admin-only. Finds order by QR code value, marks it COLLECTED.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const qrCode = String(body?.qrCode ?? "").trim();

  if (!qrCode) {
    return NextResponse.json({ error: "QR code is required" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const order = await prisma.order.findUnique({
    where: { qrCode },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      studentId: true,
      createdAt: true,
      student: { select: { name: true } },
      pickupSlot: { select: { slotTime: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Invalid QR code — order not found" }, { status: 404 });
  }

  if (order.status === "COLLECTED") {
    return NextResponse.json({ error: "Order already collected", collected: true, orderNumber: order.orderNumber }, { status: 409 });
  }

  if (order.createdAt < today) {
    return NextResponse.json({ error: "This order is not for today" }, { status: 400 });
  }

  // Mark as collected
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "COLLECTED" },
  });

  emitOrderStatusUpdate(
    order.id,
    "COLLECTED",
    order.orderNumber,
    order.studentId,
    order.pickupSlot?.slotTime ?? null
  );

  emitDashboardRefresh().catch((err) => console.error("[admin/scan] dashboard refresh failed:", err));

  return NextResponse.json({
    success: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    studentName: order.student.name,
  });
}
