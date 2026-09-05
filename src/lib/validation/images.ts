import { z } from "zod";

// Whitelisted image MIME types + 5MB limit per spec.
export const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function bytesFromDataUrl(dataUrl: string): { mime: string; bytes: number } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, b64] = match;
  // Base64 → bytes: 4 chars ≈ 3 bytes, minus padding.
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((b64.length * 3) / 4) - padding;
  return { mime, bytes };
}

/**
 * Validate an imageUrl that may be:
 * - null/empty (no image)
 * - https:// URL (remote, e.g. Cloudinary) — length-checked only
 * - data: URL (inline upload) — MIME whitelist + 5MB enforced
 * Returns error message or null when valid.
 */
export function validateImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("data:")) {
    const parsed = bytesFromDataUrl(imageUrl);
    if (!parsed) return "Invalid image data URL";
    if (!(ALLOWED_IMAGE_MIMES as readonly string[]).includes(parsed.mime)) {
      return "Image must be JPEG, PNG, or WebP";
    }
    if (parsed.bytes > MAX_IMAGE_BYTES) return "Image too large (max 5MB)";
    return null;
  }
  try {
    const u = new URL(imageUrl);
    if (u.protocol !== "https:") return "Image URL must use https";
  } catch {
    return "Invalid image URL";
  }
  if (imageUrl.length > 2048) return "Image URL too long";
  return null;
}

export const menuItemUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    basePrice: z.number().positive().max(100000).optional(),
    dietaryType: z.enum(["VEGAN", "VEGETARIAN", "NON_VEGETARIAN"]).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    imageUrl: z.string().max(7_000_000).nullable().optional(),
    isActive: z.boolean().optional(),
    ingredients: z
      .array(
        z.object({
          ingredientId: z.string().uuid(),
          quantityPerPortion: z.number().positive().max(100),
        })
      )
      .max(100)
      .optional(),
  })
  .strict();
