export type DietaryType = "VEGAN" | "VEGETARIAN" | "NON_VEGETARIAN";
export type Availability = "Available" | "Selling Fast" | "Sold Out";

export interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  dietaryType: DietaryType;
  imageUrl: string | null;
  specialPrice: number | null;
  availability: Availability;
  ingredients: { name: string; unit: string }[];
  allergenMatch: string[];
  totalOrdered: number;
}

export interface PickupSlotData {
  id: string;
  slotTime: string;
  displayLabel: string;     // "11:30 - 11:45"
  maxCapacity: number;
  currentCount: number;
}

export interface MenuPageData {
  items: MenuItemData[];
  slots: PickupSlotData[];
  userDietary: DietaryType | null;
  userAllergies: string[];
}
