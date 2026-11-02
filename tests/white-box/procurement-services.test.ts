import { describe, expect, it } from "vitest";
import {
  hasSameDayPO,
  computeReorderPlan,
  groupReorderBySupplier,
  type ReorderLine,
} from "@/lib/ras/services";
import { buildSeedData } from "@/lib/ras/seed";
import type { Ingredient, RasData } from "@/lib/ras/types";

describe("White-Box: Procurement & Reorder Services", () => {
  const createMockData = (): RasData => {
    const data = buildSeedData();
    data.purchaseOrders = [];
    data.consumptionLogs = [];
    return data;
  };

  describe("hasSameDayPO() - Branch Decision Testing", () => {
    it("Branch 1 [No PO on Date]: returns false", () => {
      const data = createMockData();
      data.purchaseOrders = [
        {
          id: "po-1",
          code: "PO-0001",
          supplierId: "sup-1",
          date: "2026-11-01",
          createdAt: "",
          lines: [{ id: "l1", ingredientId: "ing-1", quantity: 10, unitCost: 100, received: 0 }],
          status: "generated",
          createdBy: "user",
        },
      ];
      expect(hasSameDayPO(data, "ing-1", "2026-11-02")).toBe(false);
    });

    it("Branch 2 [PO on Date, Different Ingredient]: returns false", () => {
      const data = createMockData();
      data.purchaseOrders = [
        {
          id: "po-1",
          code: "PO-0001",
          supplierId: "sup-1",
          date: "2026-11-02",
          createdAt: "",
          lines: [{ id: "l1", ingredientId: "ing-other", quantity: 10, unitCost: 100, received: 0 }],
          status: "generated",
          createdBy: "user",
        },
      ];
      expect(hasSameDayPO(data, "ing-1", "2026-11-02")).toBe(false);
    });

    it("Branch 3 [PO on Date, Matching Ingredient]: returns true", () => {
      const data = createMockData();
      data.purchaseOrders = [
        {
          id: "po-1",
          code: "PO-0001",
          supplierId: "sup-1",
          date: "2026-11-02",
          createdAt: "",
          lines: [
            { id: "l1", ingredientId: "ing-1", quantity: 10, unitCost: 100, received: 0 },
          ],
          status: "generated",
          createdBy: "user",
        },
      ];
      expect(hasSameDayPO(data, "ing-1", "2026-11-02")).toBe(true);
    });
  });

  describe("computeReorderPlan() - Decision Path & Pack Size Rounding", () => {
    it("Branch 1: skips ingredients where currentStock >= threshold", () => {
      const data = createMockData();
      // Ingredient with 20 stock and 0 consumption logs -> threshold = 0
      data.ingredients = [
        {
          id: "ing-plenty",
          code: "ING-01",
          name: "Sugar",
          category: "Grains",
          unit: "kg",
          currentStock: 20,
          packSize: 5,
          unitCost: 40,
          supplierId: "sup-1",
          threshold: 10,
          createdAt: "",
        },
      ];
      const plan = computeReorderPlan(data, "2026-11-02");
      expect(plan).toHaveLength(0);
    });

    it("Branch 2: skips ingredients that already have a same-day purchase order", () => {
      const data = createMockData();
      data.ingredients = [
        {
          id: "ing-depleted",
          code: "ING-02",
          name: "Butter",
          category: "Dairy",
          unit: "kg",
          currentStock: 2,
          packSize: 5,
          unitCost: 200,
          supplierId: "sup-1",
          threshold: 10,
          createdAt: "",
        },
      ];
      // Inject logs to make threshold = 10
      // avgDaily = 5 (15 over 3 days), coverage = 2 -> threshold = 10
      data.consumptionLogs = [
        { id: "c1", ingredientId: "ing-depleted", quantity: 5, source: "issue", date: "2026-11-02", at: "" },
        { id: "c2", ingredientId: "ing-depleted", quantity: 5, source: "issue", date: "2026-11-01", at: "" },
        { id: "c3", ingredientId: "ing-depleted", quantity: 5, source: "issue", date: "2026-10-31", at: "" },
      ];

      // Add same day PO
      data.purchaseOrders.push({
        id: "po-exist",
        code: "PO-0001",
        supplierId: "sup-1",
        date: "2026-11-02",
        createdAt: "",
        lines: [{ id: "l1", ingredientId: "ing-depleted", quantity: 10, unitCost: 200, received: 0 }],
        status: "generated",
        createdBy: "user",
      });

      const plan = computeReorderPlan(data, "2026-11-02");
      expect(plan).toHaveLength(0);
    });

    it("Branch 3 & 4: computes orderQty rounded up to nearest packSize multiple", () => {
      const data = createMockData();
      data.ingredients = [
        {
          id: "ing-pack-test",
          code: "ING-03",
          name: "Atta",
          category: "Grains",
          unit: "kg",
          currentStock: 4,
          packSize: 10, // Pack size 10
          unitCost: 50,
          supplierId: "sup-1",
          threshold: 20,
          createdAt: "",
        },
      ];
      // 30 over 3 days = 10 avgDaily * 2 coverage = threshold 20
      data.consumptionLogs = [
        { id: "c1", ingredientId: "ing-pack-test", quantity: 10, source: "issue", date: "2026-11-02", at: "" },
        { id: "c2", ingredientId: "ing-pack-test", quantity: 10, source: "issue", date: "2026-11-01", at: "" },
        { id: "c3", ingredientId: "ing-pack-test", quantity: 10, source: "issue", date: "2026-10-31", at: "" },
      ];

      const plan = computeReorderPlan(data, "2026-11-02");
      expect(plan).toHaveLength(1);
      const line = plan[0]!;
      // Threshold 20, currentStock 4 -> requiredQty = 16
      expect(line.requiredQty).toBe(16);
      // Math.ceil(16 / 10) * 10 = 20
      expect(line.orderQty).toBe(20);
      expect(line.estimatedCost).toBe(20 * 50); // 1000
    });

    it("Branch 5 [PackSize <= 0 Fallback]: defaults pack size to 1 if packSize is 0", () => {
      const data = createMockData();
      data.ingredients = [
        {
          id: "ing-zero-pack",
          code: "ING-04",
          name: "Saffron",
          category: "Spices",
          unit: "g",
          currentStock: 1.5,
          packSize: 0, // Zero pack size edge case
          unitCost: 300,
          supplierId: "sup-1",
          threshold: 5,
          createdAt: "",
        },
      ];
      data.consumptionLogs = [
        { id: "c1", ingredientId: "ing-zero-pack", quantity: 2.5, source: "issue", date: "2026-11-02", at: "" },
        { id: "c2", ingredientId: "ing-zero-pack", quantity: 2.5, source: "issue", date: "2026-11-01", at: "" },
        { id: "c3", ingredientId: "ing-zero-pack", quantity: 2.5, source: "issue", date: "2026-10-31", at: "" },
      ];
      // threshold = 2.5 * 2 = 5
      // requiredQty = 5 - 1.5 = 3.5
      // pack = 1 -> orderQty = Math.ceil(3.5 / 1) * 1 = 4
      const plan = computeReorderPlan(data, "2026-11-02");
      expect(plan[0]?.orderQty).toBe(4);
    });
  });

  describe("groupReorderBySupplier() - Grouping Algorithm", () => {
    it("groups lines by their respective supplier IDs into distinct arrays", () => {
      const mockLines: ReorderLine[] = [
        {
          ingredient: { id: "i1" } as Ingredient,
          avgDaily: 5,
          threshold: 10,
          currentStock: 2,
          requiredQty: 8,
          orderQty: 10,
          supplierId: "sup-A",
          estimatedCost: 500,
        },
        {
          ingredient: { id: "i2" } as Ingredient,
          avgDaily: 2,
          threshold: 5,
          currentStock: 1,
          requiredQty: 4,
          orderQty: 5,
          supplierId: "sup-B",
          estimatedCost: 200,
        },
        {
          ingredient: { id: "i3" } as Ingredient,
          avgDaily: 10,
          threshold: 20,
          currentStock: 5,
          requiredQty: 15,
          orderQty: 15,
          supplierId: "sup-A",
          estimatedCost: 750,
        },
      ];

      const grouped = groupReorderBySupplier(createMockData(), mockLines);
      expect(grouped).toHaveLength(2); // Two unique suppliers: sup-A and sup-B
      const supAGroup = grouped.find((g) => g[0]?.supplierId === "sup-A");
      const supBGroup = grouped.find((g) => g[0]?.supplierId === "sup-B");
      expect(supAGroup).toHaveLength(2);
      expect(supBGroup).toHaveLength(1);
    });

    it("returns empty array for empty reorder lines", () => {
      expect(groupReorderBySupplier(createMockData(), [])).toEqual([]);
    });
  });
});
