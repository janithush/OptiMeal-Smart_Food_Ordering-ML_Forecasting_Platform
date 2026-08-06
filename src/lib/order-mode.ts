const PRE_ORDER_CUTOFF_HOUR = 9; // 9:00 AM

export type OrderMode = {
  mode: "PRE_ORDER" | "WALK_IN";
  message: string;
  isPreOrder: boolean;
};

/**
 * Determine whether we're in pre-order or walk-in mode.
 * Pre-order: before 9:00 AM — students must select a pickup slot.
 * Walk-in: after 9:00 AM — no slot, best-effort fulfilment.
 */
export function getOrderMode(): OrderMode {
  const now = new Date();
  const isPreOrder = now.getHours() < PRE_ORDER_CUTOFF_HOUR;

  return {
    mode: isPreOrder ? "PRE_ORDER" : "WALK_IN",
    message: isPreOrder
      ? "Pre-Order Mode — order by 9:00 AM for guaranteed pickup"
      : "Walk-In Mode — best-effort fulfilment, no time slot required",
    isPreOrder,
  };
}
