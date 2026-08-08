import { APIRequestContext } from "@playwright/test";

/**
 * API helper for ingredient endpoints.
 */

export interface IngredientData {
  id: string;
  name: string;
  unit: string;
}

/**
 * GET /api/admin/ingredients — List all ingredients.
 */
export async function getIngredients(
  api: APIRequestContext
): Promise<{ status: number; data: { ingredients: IngredientData[] } }> {
  const res = await api.get("/api/admin/ingredients");
  return { status: res.status(), data: await res.json() };
}

/**
 * POST /api/admin/ingredients — Create a new ingredient.
 */
export async function createIngredient(
  api: APIRequestContext,
  name: string,
  unit: "kg" | "liters" = "kg"
): Promise<{ status: number; data: unknown }> {
  const res = await api.post("/api/admin/ingredients", { data: { name, unit } });
  return { status: res.status(), data: await res.json() };
}
