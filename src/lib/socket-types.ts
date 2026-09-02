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
  // Story 7.2/7.3: Procurement / forecast alerts (fire-and-forget events)
  procurementAlert: (payload: {
    type: string;
    message: string;
    timestamp: string;
  }) => void;
  // Story 7.6: Model retrain rollback alert
  modelRetrainAlert: (payload: {
    rollbacks: Array<{ itemName: string; mae: number; rollbackReason: string | null }>;
    message: string;
    timestamp: string;
  }) => void;
  // Admin Management: real-time admin list updates
  adminUserAdded: (payload: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    invitedByName?: string;
    timestamp: string;
  }) => void;
  adminUserRemoved: (payload: {
    adminId: string;
    timestamp: string;
  }) => void;
  adminUserUpdated: (payload: {
    adminId: string;
    changes: Record<string, unknown>;
    timestamp: string;
  }) => void;
  // Admin Management: pending invitation count (for nav badge)
  invitationsChanged: (payload: {
    pendingCount: number;
    timestamp: string;
  }) => void;
  // Admin Management: system settings changed
  systemSettingsChanged: (payload: {
    changedBy: string;
    fields: string[];
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
