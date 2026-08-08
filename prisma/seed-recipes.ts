/**
 * prisma/seed-recipes.ts — Sri Lankan University Canteen Recipe Seeder
 *
 * 1. Upserts a full ingredient list for a typical Sri Lankan canteen.
 * 2. Upserts menu items (existing ones preserved, new ones added).
 * 3. Creates MenuItemIngredient mappings with realistic per-portion quantities.
 *
 * Usage: npx tsx prisma/seed-recipes.ts
 * Idempotent — safe to run multiple times.
 */

import { resolve } from "path";
import dotenv from "dotenv";

// Load .env.local before PrismaClient connects
dotenv.config({ path: resolve(".env.local") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ["error"] });

// ─── Ingredient definitions (name → unit) ─────────────────────────

interface IngredientDef {
  name: string;
  unit: string;
}

const INGREDIENT_LIST: IngredientDef[] = [
  // Already from CSV
  { name: "Rice", unit: "kg" },
  { name: "Vegetables", unit: "kg" },
  { name: "Chicken", unit: "kg" },
  { name: "Eggs", unit: "kg" },
  { name: "Tea Leaves", unit: "kg" },
  { name: "Milk", unit: "liters" },
  { name: "Sugar", unit: "kg" },
  // Additional for Sri Lankan canteen
  { name: "Fish", unit: "kg" },
  { name: "Soya Meat", unit: "kg" },
  { name: "Potatoes", unit: "kg" },
  { name: "Spicies", unit: "kg" },
  { name: "Coffee Powder", unit: "kg" },
  { name: "Milo/Chocolate Powder", unit: "kg" },
  { name: "Wheat Flour", unit: "kg" },
  { name: "String Hopper Flour", unit: "kg" },
  { name: "Dhal", unit: "kg" },
  { name: "Oil", unit: "liters" },
  { name: "Noodles", unit: "kg" },
  { name: "Coconut", unit: "nuts" },
  { name: "Onions", unit: "kg" },
];

// ─── Menu item definitions with ingredient mappings ───────────────

interface RecipeIngredient {
  ingredientName: string;
  quantityPerPortion: number; // kg or liters or nuts per 1 portion
}

interface MenuItemDef {
  name: string;
  basePrice: number;
  dietaryType: "NON_VEGETARIAN" | "VEGETARIAN";
  isActive: boolean;
  ingredients: RecipeIngredient[];
}

const MENU_ITEMS: MenuItemDef[] = [
  {
    name: "Chicken Rice & Curry",
    basePrice: 200,
    dietaryType: "NON_VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Rice", quantityPerPortion: 0.2 },
      { ingredientName: "Chicken", quantityPerPortion: 0.1 },
      { ingredientName: "Vegetables", quantityPerPortion: 0.1 },
      { ingredientName: "Dhal", quantityPerPortion: 0.05 },
      { ingredientName: "Coconut", quantityPerPortion: 0.1 },
      { ingredientName: "Spicies", quantityPerPortion: 0.01 },
    ],
  },
  {
    name: "Fish Rice & Curry",
    basePrice: 200,
    dietaryType: "NON_VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Rice", quantityPerPortion: 0.2 },
      { ingredientName: "Fish", quantityPerPortion: 0.1 },
      { ingredientName: "Vegetables", quantityPerPortion: 0.1 },
      { ingredientName: "Coconut", quantityPerPortion: 0.1 },
      { ingredientName: "Spicies", quantityPerPortion: 0.01 },
    ],
  },
  {
    name: "Veg/Soya Rice & Curry",
    basePrice: 160,
    dietaryType: "VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Rice", quantityPerPortion: 0.2 },
      { ingredientName: "Soya Meat", quantityPerPortion: 0.05 },
      { ingredientName: "Vegetables", quantityPerPortion: 0.1 },
      { ingredientName: "Dhal", quantityPerPortion: 0.05 },
      { ingredientName: "Coconut", quantityPerPortion: 0.1 },
      { ingredientName: "Spicies", quantityPerPortion: 0.01 },
    ],
  },
  {
    name: "Fried Rice",
    basePrice: 200,
    dietaryType: "NON_VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Rice", quantityPerPortion: 0.2 },
      { ingredientName: "Chicken", quantityPerPortion: 0.05 },
      { ingredientName: "Eggs", quantityPerPortion: 0.05 },
      { ingredientName: "Vegetables", quantityPerPortion: 0.05 },
      { ingredientName: "Oil", quantityPerPortion: 0.02 },
      { ingredientName: "Onions", quantityPerPortion: 0.02 },
    ],
  },
  {
    name: "Kottu",
    basePrice: 250,
    dietaryType: "NON_VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Wheat Flour", quantityPerPortion: 0.15 },
      { ingredientName: "Chicken", quantityPerPortion: 0.1 },
      { ingredientName: "Eggs", quantityPerPortion: 0.05 },
      { ingredientName: "Vegetables", quantityPerPortion: 0.1 },
      { ingredientName: "Spicies", quantityPerPortion: 0.02 },
      { ingredientName: "Oil", quantityPerPortion: 0.03 },
      { ingredientName: "Onions", quantityPerPortion: 0.02 },
    ],
  },
  {
    name: "String Hoppers",
    basePrice: 120,
    dietaryType: "VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "String Hopper Flour", quantityPerPortion: 0.15 },
      { ingredientName: "Coconut", quantityPerPortion: 0.2 },
      { ingredientName: "Potatoes", quantityPerPortion: 0.05 },
      { ingredientName: "Onions", quantityPerPortion: 0.02 },
      { ingredientName: "Spicies", quantityPerPortion: 0.01 },
    ],
  },
  {
    name: "Parata",
    basePrice: 100,
    dietaryType: "VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Wheat Flour", quantityPerPortion: 0.15 },
      { ingredientName: "Dhal", quantityPerPortion: 0.05 },
      { ingredientName: "Oil", quantityPerPortion: 0.03 },
      { ingredientName: "Coconut", quantityPerPortion: 0.05 },
    ],
  },
  {
    name: "Wade",
    basePrice: 60,
    dietaryType: "VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Dhal", quantityPerPortion: 0.05 },
      { ingredientName: "Oil", quantityPerPortion: 0.02 },
      { ingredientName: "Onions", quantityPerPortion: 0.01 },
      { ingredientName: "Spicies", quantityPerPortion: 0.005 },
    ],
  },
  {
    name: "Short Eats",
    basePrice: 80,
    dietaryType: "NON_VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Wheat Flour", quantityPerPortion: 0.05 },
      { ingredientName: "Potatoes", quantityPerPortion: 0.05 },
      { ingredientName: "Vegetables", quantityPerPortion: 0.03 },
      { ingredientName: "Fish", quantityPerPortion: 0.02 },
      { ingredientName: "Oil", quantityPerPortion: 0.02 },
    ],
  },
  {
    name: "Tea",
    basePrice: 50,
    dietaryType: "VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Tea Leaves", quantityPerPortion: 0.005 },
      { ingredientName: "Sugar", quantityPerPortion: 0.015 },
      { ingredientName: "Milk", quantityPerPortion: 0.05 },
    ],
  },
  {
    name: "Iced Milo",
    basePrice: 120,
    dietaryType: "VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Milo/Chocolate Powder", quantityPerPortion: 0.02 },
      { ingredientName: "Sugar", quantityPerPortion: 0.02 },
      { ingredientName: "Milk", quantityPerPortion: 0.1 },
    ],
  },
  {
    name: "Coffee",
    basePrice: 80,
    dietaryType: "VEGETARIAN",
    isActive: true,
    ingredients: [
      { ingredientName: "Coffee Powder", quantityPerPortion: 0.01 },
      { ingredientName: "Sugar", quantityPerPortion: 0.02 },
      { ingredientName: "Milk", quantityPerPortion: 0.1 },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("🌶️  CaféSmart — Sri Lankan Canteen Recipe Seeder\n");

  // ── 1. Upsert ingredients ──────────────────────────────────────
  console.log("📦 [1/3] Upserting ingredients...");
  let ingredientCount = 0;
  for (const def of INGREDIENT_LIST) {
    await prisma.ingredient.upsert({
      where: { name: def.name },
      update: { unit: def.unit },
      create: { name: def.name, unit: def.unit, isActive: true },
    });
    ingredientCount++;
  }
  console.log("   ✅ " + ingredientCount + " ingredients upserted");

  // Resolve ingredient name → id map
  const allIngredients = await prisma.ingredient.findMany({ where: { isActive: true } });
  const ingredientMap = new Map(allIngredients.map(function (i) { return [i.name, i.id] as [string, string]; }));

  // ── 2. Upsert menu items ───────────────────────────────────────
  console.log("\n🍽️  [2/3] Upserting menu items...");
  const menuItemMap = new Map<string, string>();
  let menuItemCount = 0;

  for (const def of MENU_ITEMS) {
    const existing = await prisma.menuItem.findFirst({ where: { name: def.name } });
    let id: string;
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { basePrice: def.basePrice, dietaryType: def.dietaryType, isActive: def.isActive },
      });
      id = existing.id;
    } else {
      const created = await prisma.menuItem.create({
        data: {
          name: def.name,
          basePrice: def.basePrice,
          dietaryType: def.dietaryType,
          isActive: def.isActive,
        },
      });
      id = created.id;
    }
    menuItemMap.set(def.name, id);
    menuItemCount++;
    console.log("   " + def.name + " → " + id.slice(0, 8) + "...");
  }
  console.log("   ✅ " + menuItemCount + " menu items upserted");

  // ── 3. Create MenuItemIngredient mappings ──────────────────────
  console.log("\n🔗 [3/3] Creating ingredient mappings...");
  let mappingCount = 0;

  for (const def of MENU_ITEMS) {
    const menuItemId = menuItemMap.get(def.name)!;
    for (const recipe of def.ingredients) {
      const ingredientId = ingredientMap.get(recipe.ingredientName);
      if (!ingredientId) {
        console.log("   ⚠️  Ingredient not found: " + recipe.ingredientName + " (skipping)");
        continue;
      }
      await prisma.menuItemIngredient.upsert({
        where: {
          menuItemId_ingredientId: {
            menuItemId,
            ingredientId,
          },
        },
        update: { quantityPerPortion: recipe.quantityPerPortion },
        create: {
          menuItemId,
          ingredientId,
          quantityPerPortion: recipe.quantityPerPortion,
        },
      });
      mappingCount++;
    }
  }
  console.log("   ✅ " + mappingCount + " ingredient mappings created\n");

  // ── 4. Summary ──────────────────────────────────────────────────
  const mappingRows = await prisma.menuItemIngredient.count();
  const menuRows = await prisma.menuItem.count({ where: { isActive: true } });
  const ingRows = await prisma.ingredient.count({ where: { isActive: true } });

  console.log("📊 Summary:");
  console.log("   Active Ingredients: " + ingRows);
  console.log("   Active Menu Items:  " + menuRows);
  console.log("   Ingredient Mappings: " + mappingRows);
  console.log("\n🎉 Seed complete!\n");
}

main()
  .then(function () { process.exit(0); })
  .catch(function (e: unknown) {
    console.error("Seed failed:", e);
    process.exit(1);
  });
