import { describe, expect, it } from "vitest";
import {
  stockStatus,
  averageDailyConsumption,
  computeThreshold,
} from "@/lib/ras/services";
import type { ConsumptionLog, Settings } from "@/lib/ras/types";

describe("White-Box: Inventory Services & Decision Branch Testing", () => {
  describe("stockStatus() - Multi-Condition & Boundary Path Coverage", () => {
    // Decision Flow:
    // 1. if (currentStock <= 0) return "critical";
    // 2. if (threshold <= 0) return "healthy";
    // 3. if (currentStock < threshold * 0.5) return "critical";
    // 4. if (currentStock < threshold) return "low";
    // 5. return "healthy";

    it("Branch 1 [Stock <= 0]: returns 'critical' when stock is 0 or negative", () => {
      expect(stockStatus(0, 10)).toBe("critical");
      expect(stockStatus(-2.5, 10)).toBe("critical");
      // Even if threshold is 0, stock <= 0 takes priority in evaluation order
      expect(stockStatus(0, 0)).toBe("critical");
    });

    it("Branch 2 [Threshold <= 0]: returns 'healthy' when threshold is non-positive and stock > 0", () => {
      expect(stockStatus(5, 0)).toBe("healthy");
      expect(stockStatus(10, -5)).toBe("healthy");
    });

    it("Branch 3 [Stock < Threshold * 0.5]: returns 'critical' for severely depleted stock", () => {
      const threshold = 20; // 50% = 10
      expect(stockStatus(9.9, threshold)).toBe("critical");
      expect(stockStatus(1, threshold)).toBe("critical");
    });

    it("Branch 4 [Boundary: Threshold * 0.5 <= Stock < Threshold]: returns 'low'", () => {
      const threshold = 20; // 50% = 10
      // Exactly at the 50% boundary -> should NOT be critical, should be 'low'
      expect(stockStatus(10, threshold)).toBe("low");
      expect(stockStatus(10.1, threshold)).toBe("low");
      expect(stockStatus(19.99, threshold)).toBe("low");
    });

    it("Branch 5 [Boundary: Stock >= Threshold]: returns 'healthy'", () => {
      const threshold = 20;
      // Exactly at the threshold boundary
      expect(stockStatus(20, threshold)).toBe("healthy");
      // Above threshold
      expect(stockStatus(20.01, threshold)).toBe("healthy");
      expect(stockStatus(50, threshold)).toBe("healthy");
    });
  });

  describe("averageDailyConsumption() - Data Filtering & Loop Paths", () => {
    const today = "2026-11-05";
    // 3-day window: includes 2026-11-03, 2026-11-04, 2026-11-05
    const windowDays = 3;

    it("filters logs strictly by ingredientId and window date range", () => {
      const logs: ConsumptionLog[] = [
        // Out of window (older than 2026-11-03)
        { id: "c1", ingredientId: "paneer", quantity: 50, source: "issue", date: "2026-11-02", at: "" },
        // On cutoff date (2026-11-03) - included
        { id: "c2", ingredientId: "paneer", quantity: 10, source: "issue", date: "2026-11-03", at: "" },
        // Intermediate date (2026-11-04) - included
        { id: "c3", ingredientId: "paneer", quantity: 15, source: "order", date: "2026-11-04", at: "" },
        // On today (2026-11-05) - included
        { id: "c4", ingredientId: "paneer", quantity: 5, source: "wastage", date: "2026-11-05", at: "" },
        // In the future (2026-11-06) - excluded
        { id: "c5", ingredientId: "paneer", quantity: 99, source: "order", date: "2026-11-06", at: "" },
        // Different ingredient on included date - excluded
        { id: "c6", ingredientId: "butter", quantity: 100, source: "issue", date: "2026-11-04", at: "" },
      ];

      // Sum of included paneer logs: 10 + 15 + 5 = 30
      // 30 / 3 = 10
      const avg = averageDailyConsumption(logs, "paneer", windowDays, today);
      expect(avg).toBe(10);
    });

    it("returns 0 when no matching logs exist in the window", () => {
      const logs: ConsumptionLog[] = [
        { id: "c1", ingredientId: "tomato", quantity: 10, source: "issue", date: today, at: "" },
      ];
      expect(averageDailyConsumption(logs, "paneer", windowDays, today)).toBe(0);
      expect(averageDailyConsumption([], "paneer", windowDays, today)).toBe(0);
    });
  });

  describe("computeThreshold() - Threshold Formula Path", () => {
    it("computes threshold as avgDaily * coverageDays", () => {
      const today = "2026-11-05";
      const logs: ConsumptionLog[] = [
        { id: "c1", ingredientId: "flour", quantity: 12, source: "issue", date: "2026-11-03", at: "" },
        { id: "c2", ingredientId: "flour", quantity: 15, source: "issue", date: "2026-11-04", at: "" },
        { id: "c3", ingredientId: "flour", quantity: 18, source: "issue", date: "2026-11-05", at: "" },
      ];
      // Total = 45 over 3 days -> avgDaily = 15
      // coverageDays = 2.5 -> threshold = 15 * 2.5 = 37.5
      const settings: Settings = {
        restaurantName: "RAS",
        restaurantAddress: "City Center",
        gstRate: 5,
        consumptionWindowDays: 3,
        coverageDays: 2.5,
        lowStockAlerts: true,
      };

      const result = computeThreshold(logs, "flour", settings, today);
      expect(result).toEqual({
        avgDaily: 15,
        threshold: 37.5,
      });
    });
  });
});
