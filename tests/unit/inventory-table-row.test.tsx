/**
 * Component tests for InventoryTableRow
 *
 * Story 7.1: Inventory Stock Entry & Forecasting View
 *
 * Run: npx vitest run tests/unit/inventory-table-row.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InventoryTableRow, { type IngredientRowData } from "@/components/admin/InventoryTableRow";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeIngredient(overrides: Partial<IngredientRowData> = {}): IngredientRowData {
  return {
    id: "ing-1",
    name: "Rice",
    unit: "kg",
    openingStock: null,
    closingStock: null,
    wastage: null,
    forecastedNeed: null,
    hasForecast: false,
    ...overrides,
  };
}

describe("InventoryTableRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ingredient name and unit", () => {
    render(
      <table><tbody>
        <InventoryTableRow
          ingredient={makeIngredient({ name: "Rice", unit: "kg" })}
          date="2026-08-08"
          onSaved={vi.fn()}
        />
      </tbody></table>
    );

    expect(screen.getByText("Rice")).toBeDefined();
    expect(screen.getByText("(kg)")).toBeDefined();
  });

  it("shows '—' for forecasted need when hasForecast is false", () => {
    render(
      <table><tbody>
        <InventoryTableRow
          ingredient={makeIngredient({ hasForecast: false, forecastedNeed: null })}
          date="2026-08-08"
          onSaved={vi.fn()}
        />
      </tbody></table>
    );

    // The "—" has a title tooltip
    const dashEl = screen.getByTitle("Forecast not yet generated. Runs daily at 6 PM.");
    expect(dashEl.textContent).toBe("—");
  });

  it("shows forecasted need value when hasForecast is true", () => {
    render(
      <table><tbody>
        <InventoryTableRow
          ingredient={makeIngredient({ hasForecast: true, forecastedNeed: 18.5 })}
          date="2026-08-08"
          onSaved={vi.fn()}
        />
      </tbody></table>
    );

    expect(screen.getByText("18.500")).toBeDefined();
  });

  it("computes wastage from opening - closing", () => {
    render(
      <table><tbody>
        <InventoryTableRow
          ingredient={makeIngredient({ openingStock: 25, closingStock: 22.5 })}
          date="2026-08-08"
          onSaved={vi.fn()}
        />
      </tbody></table>
    );

    // Wastage = 25 - 22.5 = 2.5
    expect(screen.getByText("2.500")).toBeDefined();
  });

  it("shows wastage as '—' when no stocks entered", () => {
    render(
      <table><tbody>
        <InventoryTableRow
          ingredient={makeIngredient({ openingStock: null, closingStock: null })}
          date="2026-08-08"
          onSaved={vi.fn()}
        />
      </tbody></table>
    );

    // Should show dash for wastage
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSaved and shows success after successful save", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        record: {
          id: "rec-1",
          ingredientId: "ing-1",
          date: "2026-08-08",
          openingStock: 25.0,
          closingStock: 22.0,
          wastage: 3.0,
          createdAt: "2026-08-08T14:00:00Z",
        },
      }),
    });

    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(
      <table><tbody>
        <InventoryTableRow
          ingredient={makeIngredient()}
          date="2026-08-08"
          onSaved={onSaved}
        />
      </tbody></table>
    );

    // Enter opening stock
    const openingInput = screen.getByLabelText("Opening stock for Rice");
    await user.clear(openingInput);
    await user.type(openingInput, "25");

    // Enter closing stock
    const closingInput = screen.getByLabelText("Closing stock for Rice");
    await user.clear(closingInput);
    await user.type(closingInput, "22");

    // Click save
    const saveBtn = screen.getByLabelText("Save Rice stock");
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/inventory",
        expect.objectContaining({ method: "POST" })
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("shows error when save fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Stock entries cannot be backdated more than 1 day." }),
    });

    const user = userEvent.setup();

    render(
      <table><tbody>
        <InventoryTableRow
          ingredient={makeIngredient()}
          date="2026-08-08"
          onSaved={vi.fn()}
        />
      </tbody></table>
    );

    // Type values to make the row dirty then save
    await user.clear(screen.getByLabelText("Opening stock for Rice"));
    await user.type(screen.getByLabelText("Opening stock for Rice"), "10");

    await user.clear(screen.getByLabelText("Closing stock for Rice"));
    await user.type(screen.getByLabelText("Closing stock for Rice"), "8");

    await user.click(screen.getByLabelText("Save Rice stock"));

    // Error text in title attribute
    await waitFor(() => {
      expect(screen.getByTitle(/backdated/)).toBeDefined();
    });
  });

  it("shows error when opening stock is negative", async () => {
    const user = userEvent.setup();

    render(
      <table><tbody>
        <InventoryTableRow
          ingredient={makeIngredient()}
          date="2026-08-08"
          onSaved={vi.fn()}
        />
      </tbody></table>
    );

    await user.clear(screen.getByLabelText("Opening stock for Rice"));
    await user.type(screen.getByLabelText("Opening stock for Rice"), "-5");

    await user.click(screen.getByLabelText("Save Rice stock"));

    // Client-side validation error appears
    await waitFor(() => {
      expect(screen.getByTitle(/non-negative/)).toBeDefined();
    });
  });

  it("save button is disabled when no changes made", () => {
    render(
      <table><tbody>
        <InventoryTableRow
          ingredient={makeIngredient({ openingStock: 25, closingStock: 22 })}
          date="2026-08-08"
          onSaved={vi.fn()}
        />
      </tbody></table>
    );

    const saveBtn = screen.getByLabelText("Save Rice stock");
    expect(saveBtn.hasAttribute("disabled")).toBe(true);
  });
});
