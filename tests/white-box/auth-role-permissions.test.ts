import { describe, expect, it } from "vitest";
import {
  ALL_MODULES,
  ROLE_HOME,
  ROLE_MODULES,
  roleCan,
  type ModuleId,
} from "@/lib/ras/store";
import type { Role } from "@/lib/ras/types";

describe("White-Box: Role-Based Access Control (RBAC) & Permission Matrix", () => {
  const roles: Role[] = ["manager", "clerk", "kitchen", "stock"];

  describe("roleCan() - Complete Permutation Matrix Testing", () => {
    it("Manager Path: has access to all 14 system modules", () => {
      for (const mod of ALL_MODULES) {
        expect(roleCan("manager", mod)).toBe(true);
      }
    });

    it("Sales Clerk Path: restricted strictly to front-of-house operations", () => {
      const allowed: ModuleId[] = ["overview", "orders", "tables", "billing"];
      for (const mod of ALL_MODULES) {
        const expected = allowed.includes(mod);
        expect(roleCan("clerk", mod)).toBe(expected);
      }
    });

    it("Kitchen Staff Path: restricted strictly to kitchen queue and inventory viewing", () => {
      const allowed: ModuleId[] = ["kitchen", "inventory"];
      for (const mod of ALL_MODULES) {
        const expected = allowed.includes(mod);
        expect(roleCan("kitchen", mod)).toBe(expected);
      }
    });

    it("Stock Keeper Path: restricted to inventory, purchase orders, suppliers, and invoices", () => {
      const allowed: ModuleId[] = ["inventory", "purchase-orders", "suppliers", "invoices"];
      for (const mod of ALL_MODULES) {
        const expected = allowed.includes(mod);
        expect(roleCan("stock", mod)).toBe(expected);
      }
    });
  });

  describe("ROLE_HOME & Navigation Route Integrity", () => {
    it("each role redirects to a valid and authorized landing page", () => {
      for (const role of roles) {
        const homePath = ROLE_HOME[role];
        expect(homePath.startsWith("/")).toBe(true);

        const homeModule = homePath.slice(1) as ModuleId;
        // The landing page module must be one of the permitted modules for that role
        expect(roleCan(role, homeModule)).toBe(true);
      }
    });

    it("ROLE_MODULES lists contain only recognized modules from ALL_MODULES", () => {
      for (const role of roles) {
        for (const mod of ROLE_MODULES[role]) {
          expect(ALL_MODULES.includes(mod)).toBe(true);
        }
      }
    });
  });
});
