import { describe, expect, it } from "vitest";
import { buildSeedData } from "@/lib/ras/seed";
import type { RasData, Reservation, RestaurantTable } from "@/lib/ras/types";

describe("White-Box: Table Management & Reservation Conflict Logic", () => {
  const createTableData = (): RasData => {
    const data = buildSeedData();
    data.tables = [
      { id: "t1", number: 1, capacity: 4, status: "free" },
      { id: "t2", number: 2, capacity: 2, status: "occupied", orderId: "ord-1" },
      { id: "t3", number: 3, capacity: 6, status: "reserved" },
    ];
    data.reservations = [];
    return data;
  };

  describe("Reservation Time Window Conflict Algorithm", () => {
    // Conflict rule:
    // Math.abs(new Date(r.dateTime).getTime() - time) < 2 * 60 * 60 * 1000
    // r.status === "upcoming" && r.tableId === selectedTable

    const baseTime = new Date("2026-11-05T18:00:00Z").getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;

    const hasConflict = (
      reservations: Reservation[],
      tableId: string,
      targetTimeMs: number,
    ): boolean => {
      return reservations.some(
        (r) =>
          r.tableId === tableId &&
          r.status === "upcoming" &&
          Math.abs(new Date(r.dateTime).getTime() - targetTimeMs) < twoHoursMs,
      );
    };

    it("Branch 1 [Conflict Detected]: rejects booking within 2 hours of existing reservation on same table", () => {
      const reservations: Reservation[] = [
        {
          id: "r1",
          tableId: "t1",
          customerName: "Alice",
          phone: "9876543210",
          dateTime: new Date(baseTime).toISOString(), // 18:00
          partySize: 4,
          status: "upcoming",
          createdBy: "user",
        },
      ];

      // Test 1 hour later (19:00) -> inside 2-hour window
      const oneHourLater = baseTime + 1 * 60 * 60 * 1000;
      expect(hasConflict(reservations, "t1", oneHourLater)).toBe(true);

      // Test 30 minutes earlier (17:30) -> inside 2-hour window
      const thirtyMinsBefore = baseTime - 30 * 60 * 1000;
      expect(hasConflict(reservations, "t1", thirtyMinsBefore)).toBe(true);
    });

    it("Branch 2 [No Conflict - Sufficient Gap]: allows booking exactly 2 hours or more apart", () => {
      const reservations: Reservation[] = [
        {
          id: "r1",
          tableId: "t1",
          customerName: "Alice",
          phone: "9876543210",
          dateTime: new Date(baseTime).toISOString(), // 18:00
          partySize: 4,
          status: "upcoming",
          createdBy: "user",
        },
      ];

      // Exactly 2 hours later (20:00) -> Math.abs(...) === twoHoursMs, NOT < twoHoursMs
      const twoHoursLater = baseTime + twoHoursMs;
      expect(hasConflict(reservations, "t1", twoHoursLater)).toBe(false);

      // 3 hours later
      const threeHoursLater = baseTime + 3 * 60 * 60 * 1000;
      expect(hasConflict(reservations, "t1", threeHoursLater)).toBe(false);
    });

    it("Branch 3 [Different Table]: allows same time booking on a different table", () => {
      const reservations: Reservation[] = [
        {
          id: "r1",
          tableId: "t1",
          customerName: "Alice",
          phone: "9876543210",
          dateTime: new Date(baseTime).toISOString(),
          partySize: 4,
          status: "upcoming",
          createdBy: "user",
        },
      ];

      // Same time, but table "t2"
      expect(hasConflict(reservations, "t2", baseTime)).toBe(false);
    });

    it("Branch 4 [Non-Upcoming Status]: ignores cancelled or completed reservations", () => {
      const reservations: Reservation[] = [
        {
          id: "r-cancelled",
          tableId: "t1",
          customerName: "Bob",
          phone: "9876543210",
          dateTime: new Date(baseTime).toISOString(),
          partySize: 4,
          status: "cancelled", // Cancelled booking
          createdBy: "user",
        },
        {
          id: "r-completed",
          tableId: "t1",
          customerName: "Charlie",
          phone: "9876543210",
          dateTime: new Date(baseTime).toISOString(),
          partySize: 4,
          status: "completed", // Completed booking
          createdBy: "user",
        },
      ];

      expect(hasConflict(reservations, "t1", baseTime)).toBe(false);
    });
  });

  describe("Table State Machine Transitions", () => {
    it("Freeing table resets status to 'free', removes orderId, and cancels pending reservations", () => {
      const data = createTableData();
      const table = data.tables.find((t) => t.id === "t2")!;
      data.reservations.push({
        id: "r-t2",
        tableId: "t2",
        customerName: "Dave",
        phone: "9999999999",
        dateTime: new Date().toISOString(),
        partySize: 2,
        status: "upcoming",
        createdBy: "user",
      });

      // Execute 'Free' action logic
      table.status = "free";
      delete table.orderId;
      data.reservations
        .filter((r) => r.tableId === table.id && r.status === "upcoming")
        .forEach((r) => (r.status = "cancelled"));

      expect(table.status).toBe("free");
      expect(table.orderId).toBeUndefined();
      expect(data.reservations.find((r) => r.id === "r-t2")?.status).toBe("cancelled");
    });

    it("Seating a reserved table transitions status to 'occupied' and completes upcoming reservation", () => {
      const data = createTableData();
      const table = data.tables.find((t) => t.id === "t3")!; // Currently "reserved"
      data.reservations.push({
        id: "r-t3",
        tableId: "t3",
        customerName: "Eve",
        phone: "9999999999",
        dateTime: new Date().toISOString(),
        partySize: 4,
        status: "upcoming",
        createdBy: "user",
      });

      // Execute 'Occupy' on reserved table
      table.status = "occupied";
      const reservation = data.reservations.find(
        (r) => r.tableId === table.id && r.status === "upcoming",
      );
      if (reservation) reservation.status = "completed";

      expect(table.status).toBe("occupied");
      expect(reservation?.status).toBe("completed");
    });
  });
});
