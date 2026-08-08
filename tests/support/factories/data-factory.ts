import { faker } from "@faker-js/faker";

// ---------------------------------------------------------------------------
// Type definitions for test data
// ---------------------------------------------------------------------------

export type TestUser = {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "ADMIN";
  department?: "ICT" | "ET" | "BST";
  dietaryPreference?: "VEGAN" | "VEGETARIAN" | "NON_VEGETARIAN";
  onboardingDone: boolean;
};

export type TestIngredient = {
  id: string;
  name: string;
  unit: "kg" | "liters";
};

export type TestInventoryRecord = {
  ingredientId: string;
  date: string;
  openingStock: number;
  closingStock: number | null;
  wastage: number | null;
};

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/**
 * Create a test user with sensible defaults.
 * Override any field for specific test scenarios.
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email({ provider: "fot.ruh.ac.lk" }),
    name: faker.person.fullName(),
    role: "STUDENT",
    onboardingDone: true,
    dietaryPreference: faker.helpers.arrayElement(["VEGAN", "VEGETARIAN", "NON_VEGETARIAN"]),
    department: faker.helpers.arrayElement(["ICT", "ET", "BST"]),
    ...overrides,
  };
}

/**
 * Create a test ingredient.
 */
export function createTestIngredient(overrides: Partial<TestIngredient> = {}): TestIngredient {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    unit: "kg",
    ...overrides,
  };
}

/**
 * Create a test inventory record.
 */
export function createTestInventoryRecord(
  overrides: Partial<TestInventoryRecord> = {}
): TestInventoryRecord {
  const openingStock = faker.number.float({ min: 5, max: 50, fractionDigits: 3 });
  const closingStock = faker.number.float({ min: 0, max: openingStock, fractionDigits: 3 });
  return {
    ingredientId: faker.string.uuid(),
    date: new Date().toISOString().split("T")[0],
    openingStock,
    closingStock,
    wastage: openingStock - closingStock,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Bulk factories
// ---------------------------------------------------------------------------

/**
 * Create multiple test ingredients at once.
 */
export function createTestIngredients(count: number): TestIngredient[] {
  const baseNames = ["Rice", "Chicken", "Dhal", "Coconut", "Flour", "Sugar", "Oil", "Onion"];
  return Array.from({ length: count }, (_, i) =>
    createTestIngredient({
      name: baseNames[i % baseNames.length] + (i >= baseNames.length ? ` ${Math.floor(i / baseNames.length)}` : ""),
    })
  );
}
