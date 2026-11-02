import { describe, expect, it } from "vitest";
import { validateOrderItem, nextCode, uid } from "@/lib/ras/services";
import { money, moneyShort, todayStr, dateStr, fmtDate } from "@/lib/ras/format";
import { buildSeedData } from "@/lib/ras/seed";

describe("White-Box: Input Validation, Code Generators, & Formatting Services", () => {
  describe("validateOrderItem() - Condition & Branch Coverage", () => {
    // Decision Tree:
    // 1. if (!Number.isFinite(quantity) || quantity <= 0) return "Quantity must be greater than zero";
    // 2. if (!Number.isInteger(quantity)) return "Quantity must be a whole number";
    // 3. return null;

    it("Branch 1A: returns error when quantity is non-finite (NaN, Infinity)", () => {
      expect(validateOrderItem(Number.NaN)).toBe("Quantity must be greater than zero");
      expect(validateOrderItem(Number.POSITIVE_INFINITY)).toBe("Quantity must be greater than zero");
      expect(validateOrderItem(Number.NEGATIVE_INFINITY)).toBe("Quantity must be greater than zero");
    });

    it("Branch 1B: returns error when quantity is zero or negative", () => {
      expect(validateOrderItem(0)).toBe("Quantity must be greater than zero");
      expect(validateOrderItem(-1)).toBe("Quantity must be greater than zero");
      expect(validateOrderItem(-0.01)).toBe("Quantity must be greater than zero");
    });

    it("Branch 2: returns error when positive quantity is a floating-point number", () => {
      expect(validateOrderItem(1.5)).toBe("Quantity must be a whole number");
      expect(validateOrderItem(0.25)).toBe("Quantity must be a whole number");
      expect(validateOrderItem(3.0001)).toBe("Quantity must be a whole number");
    });

    it("Branch 3: returns null when quantity is a valid positive whole number", () => {
      expect(validateOrderItem(1)).toBeNull();
      expect(validateOrderItem(5)).toBeNull();
      expect(validateOrderItem(100)).toBeNull();
    });
  });

  describe("nextCode() - Sequence Generator Testing", () => {
    it("increments specified counter and applies zero-padding", () => {
      const data = buildSeedData();
      data.counters.order = 7;

      const result = nextCode(data, "order", "ORD", 4);
      expect(result.next).toBe(8);
      expect(result.code).toBe("ORD-0008");

      // Larger counter test
      data.counters.bill = 999;
      const billRes = nextCode(data, "bill", "BILL", 4);
      expect(billRes.code).toBe("BILL-1000");
    });
  });

  describe("uid() - Identifier Generation", () => {
    it("generates unique strings prefixed with given tag", () => {
      const id1 = uid("reservation");
      const id2 = uid("reservation");
      expect(id1.startsWith("reservation_")).toBe(true);
      expect(id2.startsWith("reservation_")).toBe(true);
      expect(id1).not.toBe(id2);
    });
  });

  describe("Formatting Utilities - Boundary & Data Formatting", () => {
    it("formats Indian Rupee currency correctly", () => {
      expect(money(1250)).toContain("1,250.00");
      expect(money(0)).toContain("0.00");
      expect(moneyShort(15000)).toContain("15,000");
    });

    it("todayStr() produces valid YYYY-MM-DD pattern", () => {
      const today = todayStr();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(today)).toBe(true);
    });

    it("dateStr() extracts date segment from ISO timestamps", () => {
      expect(dateStr("2026-11-02T12:30:00.000Z")).toBe("2026-11-02");
    });

    it("fmtDate() formats string and Date objects gracefully", () => {
      const d = new Date(2026, 10, 2);
      expect(fmtDate(d)).toContain("2026");
      expect(fmtDate("2026-11-02T00:00:00")).toContain("2026");
    });
  });
});
