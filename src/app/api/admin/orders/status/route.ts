import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { emitOrderStatusUpdate, emitDashboardRefresh } from "@/lib/order-events";

/**
 * PATCH /api/admin/orders/status — Update order status
 * Admin-only (Story 6.2). Emits Socket.io event to the student.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { orderId, status } = body as { orderId?: string; status?: string };

  if (!orderId || !status) {
    return NextResponse.json({ error: "orderId and status required" }, { status: 400 });
  }

  const validStatuses = ["IN_PREPARATION", "READY", "COLLECTED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Valid: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true, studentId: true, pickupSlot: { select: { slotTime: true } } },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: status as "IN_PREPARATION" | "READY" | "COLLECTED" },
    select: { id: true, orderNumber: true, status: true, studentId: true, pickupSlot: { select: { slotTime: true } } },
  });

  emitOrderStatusUpdate(
    updated.id,
    updated.status,
    updated.orderNumber,
    updated.studentId,
    updated.pickupSlot?.slotTime ?? null
  );

  emitDashboardRefresh().catch((err) => console.error("[admin/status] dashboard refresh failed:", err));

  return NextResponse.json({ success: true, orderNumber: updated.orderNumber, status: updated.status });
}
