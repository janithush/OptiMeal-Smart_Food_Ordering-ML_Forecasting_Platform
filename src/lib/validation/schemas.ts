import { z } from "zod";

// Shared primitives — fail-closed: unknown keys stripped, coerced numbers rejected
export const uuidSchema = z.string().uuid("Invalid ID format");

export const orderItemInputSchema = z.object({
  menuItemId: uuidSchema,
  // Ceiling 100 aligns with MAX_PER_ITEM availability cap and the DB CHECK.
  // Anti-abuse is enforced by server-side re-pricing + wallet balance, not this bound.
  quantity: z.number().int().min(1).max(100),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createOrderSchema = z
  .object({
    orderType: z.enum(["PRE_ORDER", "WALK_IN"]),
    pickupSlotId: uuidSchema.nullable().optional(),
    coinsRedeemed: z.number().int().min(0).max(100).default(0),
    flashDealId: uuidSchema.nullable().optional(),
    items: z.array(orderItemInputSchema).min(1).max(50),
    // Client MUST supply this per-request UUID for double-submit safety.
    // Server enforces uniqueness via WalletTransaction.idempotencyKey.
    idempotencyKey: uuidSchema,
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.orderType === "PRE_ORDER" && !val.pickupSlotId) {
      ctx.addIssue({
        code: "custom",
        message: "Pickup slot required for pre-order",
        path: ["pickupSlotId"],
      });
    }
    if (val.orderType === "WALK_IN" && val.pickupSlotId) {
      ctx.addIssue({
        code: "custom",
        message: "Pickup slot must not be set for walk-in",
        path: ["pickupSlotId"],
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const menuItemCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    basePrice: z.number().positive().max(100000),
    dietaryType: z.enum(["VEGAN", "VEGETARIAN", "NON_VEGETARIAN"]),
    description: z.string().trim().max(2000).nullable().optional(),
    // Base64 data-URL or https URL. Size + MIME enforced separately server-side.
    imageUrl: z.string().max(7_000_000).nullable().optional(),
    ingredients: z
      .array(
        z.object({
          ingredientId: uuidSchema,
          quantityPerPortion: z.number().positive().max(100),
        })
      )
      .max(100)
      .optional(),
  })
  .strict();

export const walletTopupSchema = z
  .object({
    amount: z.number().positive().min(100).max(50000),
    // Per-attempt client UUID for traceability across the PayHere redirect.
    // The webhook stays keyed on PayHere order_id (format frozen for in-flight payments).
    idempotencyKey: uuidSchema.optional(),
  })
  .strict();

export const adminInviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

export const groupCheckoutSchema = z
  .object({
    pickupSlotId: uuidSchema,
    coinsRedeemed: z.number().int().min(0).max(100).default(0),
    // Client-supplied per-attempt UUID. Replays with the same key dedupe
    // instead of double-charging the organiser.
    idempotencyKey: uuidSchema,
  })
  .strict();

export type GroupCheckoutInput = z.infer<typeof groupCheckoutSchema>;
