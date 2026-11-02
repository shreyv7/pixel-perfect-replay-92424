import { describe, expect, it } from "vitest";
import { buildSeedData } from "@/lib/ras/seed";
import {
  cashBalance,
  computeBillTotals,
  computeReorderPlan,
  computeThreshold,
  paymentGap,
} from "@/lib/ras/services";
import { todayStr } from "@/lib/ras/format";

describe("restaurant business rules", () => {
  it("applies discount before GST", () => {
    expect(computeBillTotals(1000, 10, 5)).toMatchObject({
      discountAmount: 100,
      gstAmount: 45,
      grandTotal: 945,
    });
  });

  it("validates split tender and keeps bank receipts out of physical cash", () => {
    const data = buildSeedData();
    const before = cashBalance(data);
    data.cashBook.push({
      id: "bank-test",
      no: 9999,
      date: todayStr(),
      at: new Date().toISOString(),
      particulars: "UPI test",
      type: "receipt",
      mode: "bank",
      amount: 500,
      balanceAfter: before,
      refType: "bill",
      refId: "bank-test",
    });
    expect(
      paymentGap(
        [
          { id: "cash", mode: "cash", amount: 400, at: "" },
          { id: "upi", mode: "upi", amount: 600, at: "" },
        ],
        1000,
      ),
    ).toBe(0);
    expect(cashBalance(data)).toBe(before);
  });

  it("calculates the three-day average and two-day stock threshold", () => {
    const today = todayStr();
    const days = [0, 1, 2].map((offset) => {
      const date = new Date(`${today}T00:00:00`);
      date.setDate(date.getDate() - offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    });
    const logs = [10, 12, 8].map((quantity, index) => ({
      id: `log-${index}`,
      ingredientId: "paneer",
      quantity,
      source: "issue" as const,
      date: days[index]!,
      at: new Date().toISOString(),
    }));
    expect(computeThreshold(logs, "paneer", buildSeedData().settings, today)).toEqual({
      avgDaily: 10,
      threshold: 20,
    });
  });

  it("rounds a paneer reorder to full packs and avoids a same-day duplicate", () => {
    const data = buildSeedData();
    const today = todayStr();
    data.purchaseOrders = data.purchaseOrders.filter((po) => po.date !== today);
    const initial = computeReorderPlan(data, today);
    const paneer = initial.find((line) => line.ingredient.id === "ing_paneer");
    expect(paneer).toBeDefined();
    if (paneer) {
      expect(paneer.orderQty % paneer.ingredient.packSize).toBe(0);
      data.purchaseOrders.push({
        id: "duplicate-test",
        code: "PO-TEST",
        supplierId: paneer.supplierId,
        date: today,
        createdAt: new Date().toISOString(),
        lines: [
          {
            id: "line-test",
            ingredientId: paneer.ingredient.id,
            quantity: paneer.orderQty,
            unitCost: paneer.ingredient.unitCost,
            received: 0,
          },
        ],
        status: "generated",
        createdBy: "test",
      });
      expect(
        computeReorderPlan(data, today).some((line) => line.ingredient.id === "ing_paneer"),
      ).toBe(false);
      data.purchaseOrders.at(-1)!.status = "completed";
      expect(
        computeReorderPlan(data, today).some((line) => line.ingredient.id === "ing_paneer"),
      ).toBe(false);
      data.purchaseOrders.at(-1)!.status = "cancelled";
      expect(
        computeReorderPlan(data, today).some((line) => line.ingredient.id === "ing_paneer"),
      ).toBe(false);
    }
  });
});
