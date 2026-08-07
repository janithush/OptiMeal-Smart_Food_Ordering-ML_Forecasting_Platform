import type { MenuItemData } from "./menu";
import type { DietaryType } from "./menu";

export interface GroupOrderData {
  id: string;
  code: string;
  organizerId: string;
  organizerName: string;
  status: "OPEN" | "CONFIRMED" | "EXPIRED";
  pickupSlotId: string | null;
  expiresAt: string;
  createdAt: string;
  participants: GroupParticipantData[];
  cartItems: GroupCartItemData[];
}

export interface GroupParticipantData {
  id: string;
  studentId: string;
  studentName: string;
  joinedAt: string;
}

export interface GroupCartItemData {
  id: string;
  participantId: string;
  participantName: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  basePrice: number;
  dietaryType: DietaryType;
  imageUrl: string | null;
}

export interface GroupOrderCheckoutResult {
  orders: {
    orderId: string;
    orderNumber: string;
    studentName: string;
    itemCount: number;
  }[];
  totalAmount: number;
  qrCode: string;
  pickupSlot: { slotTime: string; displayLabel: string } | null;
}
