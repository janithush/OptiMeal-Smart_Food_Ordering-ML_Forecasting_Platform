import { getIO } from "./socket-server";

export interface OrderStatusPayload {
  orderId: string;
  status: string;
  orderNumber: string;
  slotDisplay: string | null;
  timestamp: string;
}

/**
 * Emit an order status change to the specific student's Socket.io room.
 * Target: student/{user:userId} room on the /student namespace.
 * Also emits to the general /student namespace for dashboard-style views.
 */
export function emitOrderStatusUpdate(
  orderId: string,
  status: string,
  orderNumber: string,
  userId: string,
  slotDisplay?: string | null
) {
  const io = getIO();
  const payload: OrderStatusPayload = {
    orderId,
    status,
    orderNumber,
    slotDisplay: slotDisplay ?? null,
    timestamp: new Date().toISOString(),
  };

  // Target the specific student's private room
  io.of("/student").to(`user:${userId}`).emit("orderStatusChanged", payload);
  // Also emit globally on /student for any listening clients
  io.of("/student").emit("orderStatusChanged", payload);

  console.log(`[events] orderStatusChanged → user:${userId} | ${orderNumber} → ${status}`);
}
