import type { MenuItemData } from "@/types/menu";

export interface CartItem {
  menuItem: MenuItemData;
  quantity: number;
}

export interface OrderResult {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  pickupSlot: { slotTime: string; displayLabel: string } | null;
  totalAmount: number;
  qrCode: string;
  items: { menuItemName: string; quantity: number; unitPrice: number; subtotal: number }[];
  createdAt: string;
}
