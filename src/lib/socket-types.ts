/**
 * Shared Socket.io TypeScript event interfaces.
 * Used by both server (socket-server.ts) and client components.
 *
 * AD-6: Two namespaces — /admin and /student.
 * JWT auth middleware will be added in Story 2.2 (RBAC).
 */

// Events the SERVER emits TO the CLIENT
export interface ServerToClientEvents {
  // Story 3.5: order status updates (payload matches OrderStatusPayload)
  orderStatusChanged: (payload: {
    orderId: string;
    status: string;
    orderNumber: string;
    slotDisplay: string | null;
    timestamp: string;
  }) => void;
  // Story 6.1: admin dashboard live KPI updates
  dashboardUpdate: (payload: Record<string, unknown>) => void;
  // Story 4.2: wallet balance updated after webhook
  walletUpdated: (payload: { newBalance: number }) => void;
}

// Events the CLIENT emits TO the SERVER
export interface ClientToServerEvents {
  // Reserved for future story use
  ping: () => void;
}

// Events exchanged between Socket.io SERVER nodes (for multi-node scale-out)
export interface InterServerEvents {
  ping: () => void;
}

// Per-socket data stored server-side (populated after JWT auth in Story 2.2)
export interface SocketData {
  userId?: string;
  role?: "STUDENT" | "ADMIN";
}
