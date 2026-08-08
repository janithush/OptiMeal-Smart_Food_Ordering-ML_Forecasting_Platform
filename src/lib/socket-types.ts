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
  dashboardUpdate: (payload: {
    totalOrders: number;
    totalRevenue: number;
    preOrderCount: number;
    walkInCount: number;
    itemsSold: { name: string; units: number }[];
    hourlySales: { hour: string; orders: number; revenue: number }[];
    slotQueueDepths: { slotId: string; label: string; depth: number; max: number }[];
    updatedAt: string;
  }) => void;
  // Story 4.2: wallet balance updated after webhook
  walletUpdated: (payload: { newBalance: number }) => void;
  // Story 6.4: Flash Deal published to all students
  flashDealPublished: (payload: {
    id: string;
    menuItemId: string;
    menuItemName: string;
    dietaryType: string;
    imageUrl: string | null;
    basePrice: number;
    discountPercent: number;
    discountedPrice: number;
    message: string | null;
    expiresAt: string;
  }) => void;
  // Story 6.4: Flash Deal cancelled
  flashDealCancelled: (payload: { flashDealId: string; menuItemId: string }) => void;
  // Story 6.4: Smart discount alert on admin dashboard
  smartDiscountAlert: (payload: {
    menuItemId: string;
    name: string;
    cookPlanTarget: number;
    unitsSold: number;
    percentSold: number;
    currentPrice: number;
    checkedAt: string;
  }) => void;
  // Story 6.4: Flash Deal created (admin-only event)
  flashDealCreated: (payload: {
    id: string;
    menuItemId: string;
    menuItemName: string;
    dietaryType: string;
    imageUrl: string | null;
    basePrice: number;
    discountPercent: number;
    discountedPrice: number;
    message: string | null;
    expiresAt: string;
  }) => void;
  // Story 7.3: Staff planning high-traffic flag
  staffPlanningUpdate: (payload: {
    date: string;
    highTraffic: boolean;
    predictedTotal: number;
    rollingAvg: number;
    timestamp: string;
  }) => void;
  // Story 7.4: Cook Plan ready after post-cutoff update
  cookPlanReady: (payload: {
    date: string;
    itemCount: number;
    timestamp: string;
  }) => void;
  // Story 7.4: Cook Plan confirmed by Admin
  cookPlanConfirmed: (payload: {
    date: string;
    confirmedBy: string;
    itemCount: number;
    timestamp: string;
  }) => void;
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
