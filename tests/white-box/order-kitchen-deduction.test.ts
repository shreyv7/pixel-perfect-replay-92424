import { describe, expect, it } from "vitest";
import { orderTotal, deductOrderIngredients } from "@/lib/ras/services";
import { buildSeedData } from "@/lib/ras/seed";
import type { Order, RasData } from "@/lib/ras/types";

describe("White-Box: Order Calculations & Kitchen Stock Deduction Logic", () => {
  describe("orderTotal() - Structural Path Testing", () => {
    it("returns 0 for order with empty items", () => {
      const order: Order = {
        id: "ord-empty",
        code: "ORD-0001",
        items: [],
        status: "placed",
        placedAt: "",
        placedBy: "clerk",
      };
      expect(orderTotal(order)).toBe(0);
    });

    it("sums multiple items with fractional quantities and unit prices", () => {
      const order: Order = {
        id: "ord-1",
        code: "ORD-0001",
        items: [
          { id: "i1", menuItemId: "m1", name: "Dish 1", unitPrice: 250, quantity: 2 }, // 500
          { id: "i2", menuItemId: "m2", name: "Dish 2", unitPrice: 75.5, quantity: 3 }, // 226.5
        ],
        status: "placed",
        placedAt: "",
        placedBy: "clerk",
      };
      expect(orderTotal(order)).toBe(726.5);
    });
  });

  describe("deductOrderIngredients() - Structural Path & Decision Testing", () => {
    const setupTestData = (): { data: RasData; order: Order } => {
      const data = buildSeedData();
      data.notifications = [];
      data.auditLog = [];
      data.consumptionLogs = [];

      // Create test menu items with defined recipes
      data.ingredients = [
        {
          id: "ing_butter",
          code: "ING-B",
          name: "Butter",
          category: "Dairy",
          unit: "kg",
          currentStock: 5.0,
          packSize: 1,
          unitCost: 400,
          supplierId: "sup-1",
          threshold: 2.0,
          createdAt: "",
        },
        {
          id: "ing_paneer",
          code: "ING-P",
          name: "Paneer",
          category: "Dairy",
          unit: "kg",
          currentStock: 3.0,
          packSize: 1,
          unitCost: 300,
          supplierId: "sup-1",
          threshold: 1.5,
          createdAt: "",
        },
      ];

      data.menuItems = [
        {
          id: "m_paneer_tikka",
          code: "M-01",
          name: "Paneer Tikka",
          category: "Starters",
          price: 250,
          available: true,
          recipe: [
            { ingredientId: "ing_paneer", quantity: 0.2 }, // 200g
            { ingredientId: "ing_butter", quantity: 0.05 }, // 50g
          ],
        },
        {
          id: "m_butter_naan",
          code: "M-02",
          name: "Butter Naan",
          category: "Breads",
          price: 60,
          available: true,
          recipe: [
            { ingredientId: "ing_butter", quantity: 0.05 }, // 50g
          ],
        },
        {
          id: "m_no_recipe",
          code: "M-03",
          name: "Bottled Water",
          category: "Beverages",
          price: 20,
          available: true,
          recipe: [], // Empty recipe
        },
      ];

      const order: Order = {
        id: "ord-deduct-test",
        code: "ORD-9999",
        items: [
          { id: "line-1", menuItemId: "m_paneer_tikka", name: "Paneer Tikka", unitPrice: 250, quantity: 2 },
          { id: "line-2", menuItemId: "m_butter_naan", name: "Butter Naan", unitPrice: 60, quantity: 4 },
          { id: "line-3", menuItemId: "m_no_recipe", name: "Bottled Water", unitPrice: 20, quantity: 1 },
          { id: "line-4", menuItemId: "m_non_existent", name: "Ghost Item", unitPrice: 100, quantity: 1 },
        ],
        status: "placed",
        placedAt: new Date().toISOString(),
        placedBy: "clerk-1",
      };

      return { data, order };
    };

    it("Path 1 [Standard Deduction & Aggregation]: deducts correct total ingredient amounts across items", () => {
      const { data, order } = setupTestData();
      // Calculations:
      // Paneer Tikka x2:
      //   - Paneer: 0.2 * 2 = 0.4 kg
      //   - Butter: 0.05 * 2 = 0.1 kg
      // Butter Naan x4:
      //   - Butter: 0.05 * 4 = 0.2 kg
      // Total Butter = 0.1 + 0.2 = 0.3 kg
      // Total Paneer = 0.4 kg

      const result = deductOrderIngredients(data, order, "kitchen-user");

      expect(order.ingredientsDeducted).toBe(true);
      expect(result.deducted).toHaveLength(2);

      const butter = data.ingredients.find((i) => i.id === "ing_butter")!;
      const paneer = data.ingredients.find((i) => i.id === "ing_paneer")!;

      expect(butter.currentStock).toBe(4.7); // 5.0 - 0.3 = 4.7
      expect(paneer.currentStock).toBe(2.6); // 3.0 - 0.4 = 2.6

      // Verifies consumption log created
      expect(data.consumptionLogs).toHaveLength(2);
      expect(data.consumptionLogs.every((l) => l.source === "order")).toBe(true);

      // Verifies audit log created
      expect(data.auditLog).toHaveLength(1);
      expect(data.auditLog[0]?.action).toBe("ingredient_consumed");
      expect(data.auditLog[0]?.actor).toBe("kitchen-user");
    });

    it("Path 2 [Idempotency]: does not double-deduct if ingredients were already deducted", () => {
      const { data, order } = setupTestData();
      order.ingredientsDeducted = true; // Flag already set

      const result = deductOrderIngredients(data, order, "kitchen-user");
      expect(result.deducted).toHaveLength(0);

      // Stock remains untouched
      const butter = data.ingredients.find((i) => i.id === "ing_butter")!;
      expect(butter.currentStock).toBe(5.0);
      expect(data.consumptionLogs).toHaveLength(0);
      expect(data.auditLog).toHaveLength(0);
    });

    it("Path 3 [Deficit Clamping]: clamps currentStock to 0 when quantity needed exceeds stock", () => {
      const { data, order } = setupTestData();
      // Set initial stock to less than needed
      const butter = data.ingredients.find((i) => i.id === "ing_butter")!;
      butter.currentStock = 0.1; // Only 100g available, but 300g needed

      deductOrderIngredients(data, order, "kitchen-user");
      // Must not go negative (-0.2); should clamp to 0
      expect(butter.currentStock).toBe(0);
    });

    it("Path 4 [Low Stock Notification]: triggers low_stock alert when stock falls below threshold", () => {
      const { data, order } = setupTestData();
      data.settings.lowStockAlerts = true;
      const paneer = data.ingredients.find((i) => i.id === "ing_paneer")!;
      // threshold is 1.5. If currentStock starts at 1.7, deducting 0.4 drops it to 1.3 (< 1.5)
      paneer.currentStock = 1.7;

      deductOrderIngredients(data, order, "kitchen-user");

      const notif = data.notifications.find((n) => n.type === "low_stock");
      expect(notif).toBeDefined();
      expect(notif?.title).toContain("Paneer");
    });

    it("Path 5 [Alerts Disabled]: suppresses low_stock alert when settings.lowStockAlerts is false", () => {
      const { data, order } = setupTestData();
      data.settings.lowStockAlerts = false;
      const paneer = data.ingredients.find((i) => i.id === "ing_paneer")!;
      paneer.currentStock = 1.0; // Already below threshold

      deductOrderIngredients(data, order, "kitchen-user");
      expect(data.notifications.filter((n) => n.type === "low_stock")).toHaveLength(0);
    });
  });
});
