import { describe, expect, it } from "vitest";
import {
  computeBillTotals,
  round2,
  sumPayments,
  paymentGap,
  paymentAffectsCashDrawer,
} from "@/lib/ras/services";
import type { Payment } from "@/lib/ras/types";

describe("White-Box: Billing & Mathematical Calculation Services", () => {
  describe("computeBillTotals() - Branch & Boundary Testing", () => {
    it("Path 1 [Standard]: computes normal subtotal, discount, taxable, GST, and grandTotal", () => {
      // Input: subtotal=1000, discount=10%, gst=5%
      // discount = 100, taxable = 900, gst = 45, grandTotal = 945
      const result = computeBillTotals(1000, 10, 5);
      expect(result).toEqual({
        subtotal: 1000,
        discountAmount: 100,
        taxable: 900,
        gstAmount: 45,
        grandTotal: 945,
      });
    });

    it("Path 2 [Negative Discount Boundary]: clamps negative discount to 0%", () => {
      // Condition: Math.max(0, Math.min(100, discountPct))
      // When discount is -15, it should clamp to 0
      const result = computeBillTotals(500, -15, 10);
      expect(result.discountAmount).toBe(0);
      expect(result.taxable).toBe(500);
      expect(result.gstAmount).toBe(50);
      expect(result.grandTotal).toBe(550);
    });

    it("Path 3 [Excessive Discount Boundary]: clamps discount > 100% to 100%", () => {
      // When discount is 120%, it should clamp to 100%
      const result = computeBillTotals(800, 120, 18);
      expect(result.discountAmount).toBe(800);
      expect(result.taxable).toBe(0);
      expect(result.gstAmount).toBe(0);
      expect(result.grandTotal).toBe(0);
    });

    it("Path 4 [Falsy Discount]: handles 0, NaN, undefined by defaulting to 0", () => {
      const resNaN = computeBillTotals(400, Number.NaN, 5);
      expect(resNaN.discountAmount).toBe(0);
      expect(resNaN.grandTotal).toBe(420);

      const resZero = computeBillTotals(400, 0, 0);
      expect(resZero.discountAmount).toBe(0);
      expect(resZero.gstAmount).toBe(0);
      expect(resZero.grandTotal).toBe(400);
    });

    it("Path 5 [Zero Subtotal & Fractional Values]: accurately rounds fractional prices", () => {
      // 333.33 subtotal with 7.5% discount and 18% GST
      // discount = round2(333.33 * 0.075) = 25.00
      // taxable = round2(333.33 - 25.00) = 308.33
      // gst = round2(308.33 * 0.18) = 55.50
      // grandTotal = round2(308.33 + 55.50) = 363.83
      const result = computeBillTotals(333.33, 7.5, 18);
      expect(result.discountAmount).toBe(25);
      expect(result.taxable).toBe(308.33);
      expect(result.gstAmount).toBe(55.5);
      expect(result.grandTotal).toBe(363.83);
    });
  });

  describe("round2() - Internal Numeric Rounding", () => {
    it("accurately rounds 2-decimal floats at .005 boundaries", () => {
      expect(round2(10.234)).toBe(10.23);
      expect(round2(10.235)).toBe(10.24);
      expect(round2(0)).toBe(0);
      expect(round2(-4.555)).toBe(-4.55); // Math.round(-455.5) = -455 -> -4.55
      expect(round2(100)).toBe(100);
    });
  });

  describe("sumPayments() & paymentGap() - Multi-Tender Split Paths", () => {
    it("handles empty payments array as 0", () => {
      expect(sumPayments([])).toBe(0);
      expect(paymentGap([], 500)).toBe(500);
    });

    it("Path 1 [Exact Match]: gap is 0 when payments equal grandTotal", () => {
      const payments: Payment[] = [
        { id: "p1", mode: "cash", amount: 250 },
        { id: "p2", mode: "upi", amount: 250 },
      ];
      expect(sumPayments(payments)).toBe(500);
      expect(paymentGap(payments, 500)).toBe(0);
    });

    it("Path 2 [Underpaid]: returns positive remaining gap", () => {
      const payments: Payment[] = [
        { id: "p1", mode: "card", amount: 300 },
      ];
      expect(paymentGap(payments, 450)).toBe(150);
    });

    it("Path 3 [Overpaid / Change Required]: returns negative gap", () => {
      const payments: Payment[] = [
        { id: "p1", mode: "cash", amount: 600 },
      ];
      expect(paymentGap(payments, 500)).toBe(-100);
    });
  });

  describe("paymentAffectsCashDrawer() - Tender Classification Path", () => {
    it("returns true strictly for 'cash' mode", () => {
      expect(paymentAffectsCashDrawer("cash")).toBe(true);
    });

    it("returns false for non-cash electronic tender ('upi' and 'card')", () => {
      expect(paymentAffectsCashDrawer("upi")).toBe(false);
      expect(paymentAffectsCashDrawer("card")).toBe(false);
    });
  });
});
