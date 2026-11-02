// Centralized business logic for billing, procurement, inventory and accounts.
// All functions are pure: they take values/data and return results.

import type {
  Bill,
  ConsumptionLog,
  Ingredient,
  Order,
  Payment,
  PurchaseOrder,
  RasData,
  Settings,
} from "./types";

// ---------- Billing ----------

export interface BillTotals {
  subtotal: number;
  discountAmount: number;
  taxable: number;
  gstAmount: number;
  grandTotal: number;
}

export function computeBillTotals(
  subtotal: number,
  discountPct: number,
  gstPct: number,
): BillTotals {
  const safeDiscount = Math.max(0, Math.min(100, discountPct || 0));
  const discountAmount = round2((subtotal * safeDiscount) / 100);
  const taxable = round2(subtotal - discountAmount);
  const gstAmount = round2((taxable * (gstPct || 0)) / 100);
  const grandTotal = round2(taxable + gstAmount);
  return { subtotal: round2(subtotal), discountAmount, taxable, gstAmount, grandTotal };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sumPayments(payments: Payment[]): number {
  return round2(payments.reduce((s, p) => s + p.amount, 0));
}

/** Returns the remaining amount still to be tendered (0 when fully covered). */
export function paymentGap(payments: Payment[], grandTotal: number): number {
  return round2(grandTotal - sumPayments(payments));
}

/** Cash sales move the cash drawer; UPI/Card are receipts but not physical cash. */
export function paymentAffectsCashDrawer(mode: Payment["mode"]): boolean {
  return mode === "cash";
}

// ---------- Inventory ----------

export type StockStatus = "healthy" | "low" | "critical";

export function stockStatus(currentStock: number, threshold: number): StockStatus {
  if (currentStock <= 0) return "critical";
  if (threshold <= 0) return "healthy";
  if (currentStock < threshold * 0.5) return "critical";
  if (currentStock < threshold) return "low";
  return "healthy";
}

/** Average daily consumption over the configured rolling window. */
export function averageDailyConsumption(
  logs: ConsumptionLog[],
  ingredientId: string,
  windowDays: number,
  today: string,
): number {
  const cutoff = new Date(today + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - (windowDays - 1));
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  const total = logs
    .filter((l) => l.ingredientId === ingredientId && l.date >= cutoffStr && l.date <= today)
    .reduce((s, l) => s + l.quantity, 0);
  return round2(total / windowDays);
}

export interface ThresholdResult {
  avgDaily: number;
  threshold: number;
}

/** Threshold = Average Daily Consumption x coverage days (default 2). */
export function computeThreshold(
  logs: ConsumptionLog[],
  ingredientId: string,
  settings: Settings,
  today: string,
): ThresholdResult {
  const avgDaily = averageDailyConsumption(
    logs,
    ingredientId,
    settings.consumptionWindowDays,
    today,
  );
  return { avgDaily, threshold: round2(avgDaily * settings.coverageDays) };
}

export interface ReorderLine {
  ingredient: Ingredient;
  avgDaily: number;
  threshold: number;
  currentStock: number;
  requiredQty: number;
  orderQty: number; // rounded UP to nearest pack size
  supplierId: string;
  estimatedCost: number;
}

export function hasSameDayPO(data: RasData, ingredientId: string, date: string): boolean {
  return data.purchaseOrders.some(
    (po) => po.date === date && po.lines.some((l) => l.ingredientId === ingredientId),
  );
}

export function computeReorderPlan(data: RasData, today: string): ReorderLine[] {
  const lines: ReorderLine[] = [];
  for (const ing of data.ingredients) {
    const { avgDaily, threshold } = computeThreshold(
      data.consumptionLogs,
      ing.id,
      data.settings,
      today,
    );
    if (ing.currentStock >= threshold) continue;
    if (hasSameDayPO(data, ing.id, today)) continue;
    const requiredQty = round2(threshold - ing.currentStock);
    const pack = ing.packSize > 0 ? ing.packSize : 1;
    const orderQty = round2(Math.ceil(requiredQty / pack) * pack);
    lines.push({
      ingredient: ing,
      avgDaily,
      threshold,
      currentStock: ing.currentStock,
      requiredQty,
      orderQty,
      supplierId: ing.supplierId,
      estimatedCost: round2(orderQty * ing.unitCost),
    });
  }
  return lines;
}

export function groupReorderBySupplier(data: RasData, lines: ReorderLine[]): ReorderLine[][] {
  const map = new Map<string, ReorderLine[]>();
  for (const line of lines) {
    const arr = map.get(line.supplierId) ?? [];
    arr.push(line);
    map.set(line.supplierId, arr);
  }
  return Array.from(map.values());
}

// ---------- Orders / kitchen ----------

export const KITCHEN_ACTIVE_STATUSES: Order["status"][] = ["placed", "preparing", "ready"];
export const ORDER_ACTIVE_STATUSES: Order["status"][] = ["placed", "preparing", "ready", "served", "billed"];

export function orderTotal(order: Order): number {
  return round2(order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
}

/** Deduct recipe ingredients for all items in an order when food is prepared. */
export function deductOrderIngredients(
  d: RasData,
  order: Order,
  actorId?: string,
): { deducted: { ingredientName: string; quantity: number; unit: string }[] } {
  if (order.ingredientsDeducted) {
    return { deducted: [] };
  }

  const at = new Date().toISOString();
  const today = at.slice(0, 10);
  const deducted: { ingredientName: string; quantity: number; unit: string }[] = [];

  const needed = new Map<string, number>();

  for (const item of order.items) {
    const menuItem = d.menuItems.find((m) => m.id === item.menuItemId);
    if (!menuItem || !menuItem.recipe || menuItem.recipe.length === 0) continue;

    for (const r of menuItem.recipe) {
      const prev = needed.get(r.ingredientId) || 0;
      needed.set(r.ingredientId, round2(prev + r.quantity * item.quantity));
    }
  }

  for (const [ingredientId, qty] of needed.entries()) {
    const ing = d.ingredients.find((i) => i.id === ingredientId);
    if (!ing) continue;

    ing.currentStock = Math.max(0, round2(ing.currentStock - qty));

    d.consumptionLogs.push({
      id: uid("consumption"),
      ingredientId: ing.id,
      quantity: qty,
      source: "order",
      date: today,
      at,
    });

    deducted.push({
      ingredientName: ing.name,
      quantity: qty,
      unit: ing.unit,
    });

    if (d.settings.lowStockAlerts && ing.currentStock < ing.threshold) {
      d.notifications.unshift({
        id: uid("notif"),
        type: "low_stock",
        title: `Low stock alert: ${ing.name}`,
        message: `${ing.name} is down to ${ing.currentStock} ${ing.unit} (threshold: ${ing.threshold} ${ing.unit}).`,
        at,
        read: false,
      });
    }
  }

  if (deducted.length > 0) {
    d.auditLog.unshift({
      id: uid("audit"),
      at,
      actor: actorId || "kitchen",
      action: "ingredient_consumed",
      details: `${order.code} prepared: ${deducted.map((x) => `${x.quantity} ${x.unit} of ${x.ingredientName}`).join(", ")}`,
    });
  }

  order.ingredientsDeducted = true;
  return { deducted };
}

// ---------- Accounts / cash book ----------

/** Physical cash balance (cash-mode entries only; UPI/Card never inflate it). */
export function cashBalance(data: RasData): number {
  const last = [...data.cashBook]
    .filter((e) => e.mode === "cash")
    .sort((a, b) => a.no - b.no)
    .pop();
  return last ? round2(last.balanceAfter) : 0;
}

export function totalReceipts(data: RasData): number {
  return round2(
    data.cashBook.filter((e) => e.type === "receipt").reduce((s, e) => s + e.amount, 0),
  );
}

export function totalExpenses(data: RasData): number {
  return round2(
    data.cashBook.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0),
  );
}

// ---------- IDs ----------

export function nextCode(
  data: RasData,
  key: "order" | "bill" | "purchaseOrder" | "invoice" | "cheque",
  prefix: string,
  pad = 4,
): {
  code: string;
  next: number;
} {
  const n = data.counters[key] + 1;
  return { code: `${prefix}-${String(n).padStart(pad, "0")}`, next: n };
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Validation ----------

export function validateOrderItem(quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return "Quantity must be greater than zero";
  if (!Number.isInteger(quantity)) return "Quantity must be a whole number";
  return null;
}
