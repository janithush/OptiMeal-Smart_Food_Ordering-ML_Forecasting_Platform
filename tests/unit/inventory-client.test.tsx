/**
 * Component tests for InventoryClient
 *
 * Story 7.1: Inventory Stock Entry & Forecasting View
 *
 * Run: npx vitest run tests/unit/inventory-client.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import InventoryClient from "@/app/admin/inventory/InventoryClient";
import type { IngredientRowData } from "@/components/admin/InventoryTableRow";

// Mock framer-motion (avoids animation issues in jsdom)
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    tr: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <tr {...props}>{children}</tr>
    ),
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeInitialData(overrides?: Partial<{ date: string; ingredients: IngredientRowData[] }>) {
  return {
    date: "2026-08-08",
    ingredients: [
      {
        id: "ing-1",
        name: "Rice",
        unit: "kg",
        openingStock: 25.0,
        closingStock: 22.0,
        wastage: 3.0,
        forecastedNeed: 18.5,
        hasForecast: true,
      },
    ],
    ...overrides,
  };
}

describe("InventoryClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the page title and user greeting", () => {
    render(
      <InventoryClient userName="Admin Janith" initialData={makeInitialData()} />
    );

    expect(screen.getByText("Inventory")).toBeDefined();
    expect(screen.getByText("Welcome, Admin Janith")).toBeDefined();
  });

  it("shows today's date with 'Today' badge", () => {
    const todayStr = new Date().toISOString().split("T")[0];
    render(
      <InventoryClient
        userName="Admin"
        initialData={makeInitialData({ date: todayStr })}
      />
    );

    // Should show 'Today' badge
    expect(screen.getByText("Today")).toBeDefined();
  });

  it("shows '7-Day History' toggle button", () => {
    render(
      <InventoryClient userName="Admin" initialData={makeInitialData()} />
    );

    expect(screen.getByText("7-Day History")).toBeDefined();
  });

  it("shows empty state when no ingredients configured", () => {
    render(
      <InventoryClient
        userName="Admin"
        initialData={makeInitialData({ ingredients: [] })}
      />
    );

    expect(
      screen.getByText("No ingredients configured yet.")
    ).toBeDefined();
  });

  it("shows empty state when no stock records exist", () => {
    render(
      <InventoryClient
        userName="Admin"
        initialData={makeInitialData({
          ingredients: [
            {
              id: "ing-1",
              name: "Rice",
              unit: "kg",
              openingStock: null,
              closingStock: null,
              wastage: null,
              forecastedNeed: null,
              hasForecast: false,
            },
          ],
        })}
      />
    );

    expect(
      screen.getByText(/No inventory records for/)
    ).toBeDefined();
  });

  it("renders table headers", () => {
    render(
      <InventoryClient userName="Admin" initialData={makeInitialData()} />
    );

    expect(screen.getByText("Ingredient")).toBeDefined();
    expect(screen.getByText("Opening")).toBeDefined();
    expect(screen.getByText("Closing")).toBeDefined();
    expect(screen.getByText("Wastage")).toBeDefined();
    expect(screen.getByText("Forecasted Need")).toBeDefined();
  });

  it("renders ingredient rows from initial data", () => {
    render(
      <InventoryClient userName="Admin" initialData={makeInitialData()} />
    );

    // Ingredient name should appear
    expect(screen.getByText("Rice")).toBeDefined();
    // Forecasted need
    expect(screen.getByText("18.500")).toBeDefined();
  });

  it("renders date navigation buttons", () => {
    render(
      <InventoryClient userName="Admin" initialData={makeInitialData()} />
    );

    expect(screen.getByLabelText("Previous day")).toBeDefined();
    expect(screen.getByLabelText("Next day")).toBeDefined();
  });
});
