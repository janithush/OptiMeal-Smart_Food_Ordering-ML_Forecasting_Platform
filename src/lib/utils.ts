import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes intelligently, avoiding class conflicts.
 * Used by all shadcn/ui components and custom components in CaféSmart.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
