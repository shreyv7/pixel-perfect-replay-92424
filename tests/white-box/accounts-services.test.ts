import { describe, expect, it } from "vitest";
import { cashBalance, totalReceipts, totalExpenses } from "@/lib/ras/services";
import { buildSeedData } from "@/lib/ras/seed";
import type { CashBookEntry, RasData } from "@/lib/ras/types";

describe("White-Box: Cash Book & Accounting Services", () => {
  const createBaseData = (): RasData => {
    const data = buildSeedData();
    data.cashBook = [];
    return data;
  };

  describe("cashBalance() - Filter & Sort Decision Testing", () => {
    it("Path 1 [Empty Cash Book]: returns 0", () => {
      const data = createBaseData();
      expect(cashBalance(data)).toBe(0);
    });

    it("Path 2 [No Physical Cash Mode]: returns 0 when all transactions are digital/bank", () => {
      const data = createBaseData();
      data.cashBook = [
        {
          id: "cb-1",
          no: 1,
          date: "2026-11-01",
          at: "",
          particulars: "Online UPI payment",
          type: "receipt",
          mode: "bank",
          amount: 1500,
          balanceAfter: 1500,
          refType: "bill",
          refId: "b1",
        },
      ];
      expect(cashBalance(data)).toBe(0);
    });

    it("Path 3 [Order Independence & Latest Balance]: sorts by sequence number and returns latest cash balance", () => {
      const data = createBaseData();
      // Insert in unordered sequence to test the `.sort((a, b) => a.no - b.no)` branch
      const entries: CashBookEntry[] = [
        {
          id: "cb-3",
          no: 3,
          date: "2026-11-02",
          at: "",
          particulars: "Evening Cash Sale",
          type: "receipt",
          mode: "cash",
          amount: 800,
          balanceAfter: 4800,
          refType: "bill",
          refId: "b3",
        },
        {
          id: "cb-1",
          no: 1,
          date: "2026-11-01",
          at: "",
          particulars: "Opening Float",
          type: "receipt",
          mode: "cash",
          amount: 5000,
          balanceAfter: 5000,
          refType: "deposit",
          refId: "d1",
        },
        {
          id: "cb-2",
          no: 2,
          date: "2026-11-01",
          at: "",
          particulars: "Vegetable Purchase",
          type: "expense",
          mode: "cash",
          amount: 1000,
          balanceAfter: 4000,
          refType: "petty",
          refId: "p1",
        },
        {
          id: "cb-4",
          no: 4,
          date: "2026-11-02",
          at: "",
          particulars: "Card Settlement (Non-cash)",
          type: "receipt",
          mode: "bank",
          amount: 2000,
          balanceAfter: 6800,
          refType: "bill",
          refId: "b4",
        },
      ];
      data.cashBook = entries;

      // The highest `no` where mode === "cash" is no=3 with balanceAfter = 4800
      expect(cashBalance(data)).toBe(4800);
    });
  });

  describe("totalReceipts() & totalExpenses() - Type Filter Paths", () => {
    it("aggregates receipts and expenses strictly based on type discriminator", () => {
      const data = createBaseData();
      data.cashBook = [
        { id: "1", no: 1, date: "", at: "", particulars: "", type: "receipt", mode: "cash", amount: 500.25, balanceAfter: 500.25, refType: "bill", refId: "" },
        { id: "2", no: 2, date: "", at: "", particulars: "", type: "expense", mode: "cash", amount: 150.5, balanceAfter: 349.75, refType: "petty", refId: "" },
        { id: "3", no: 3, date: "", at: "", particulars: "", type: "receipt", mode: "bank", amount: 1200.0, balanceAfter: 1549.75, refType: "bill", refId: "" },
        { id: "4", no: 4, date: "", at: "", particulars: "", type: "expense", mode: "bank", amount: 300.0, balanceAfter: 1249.75, refType: "vendor", refId: "" },
      ];

      expect(totalReceipts(data)).toBe(1700.25); // 500.25 + 1200.00
      expect(totalExpenses(data)).toBe(450.5); // 150.50 + 300.00
    });
  });
});
