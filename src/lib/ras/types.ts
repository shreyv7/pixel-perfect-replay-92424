// Central data models for the Restaurant Automation System (RAS).

export type Role = "manager" | "clerk" | "kitchen" | "stock";

export interface User {
  id: string;
  userId: string; // login handle
  password: string;
  name: string;
  role: Role;
  active: boolean;
}

export type Unit = "kg" | "g" | "litre" | "ml" | "piece" | "pack";

export interface Ingredient {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: Unit;
  currentStock: number;
  packSize: number;
  unitCost: number; // cost per unit (INR)
  supplierId: string;
  threshold: number; // last computed threshold
  createdAt: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  ingredientIds: string[];
}

export interface RecipeLine {
  ingredientId: string;
  quantity: number;
}

export type MenuCategory =
  "Starters" | "Main Course" | "Breads" | "Rice" | "Desserts" | "Beverages";

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  category: MenuCategory;
  price: number;
  recipe: RecipeLine[];
  available: boolean;
}

export interface PriceChange {
  id: string;
  menuItemId: string;
  oldPrice: number;
  newPrice: number;
  at: string;
  by: string;
}

export type TableStatus = "free" | "reserved" | "occupied";

export interface RestaurantTable {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  orderId?: string; // order currently seated
}

export type ReservationStatus = "upcoming" | "completed" | "cancelled";

export interface Reservation {
  id: string;
  tableId: string;
  customerName: string;
  phone: string;
  dateTime: string;
  partySize: number;
  status: ReservationStatus;
  createdBy: string;
}

export type OrderStatus = "placed" | "preparing" | "ready" | "served" | "billed" | "paid" | "cancelled";

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  unitPrice: number; // snapshot at placement
  quantity: number;
}

export interface Order {
  id: string;
  code: string;
  tableId?: string;
  items: OrderItem[];
  status: OrderStatus;
  placedAt: string;
  placedBy: string;
  acceptedAt?: string;
  startedAt?: string;
  readyAt?: string;
  servedAt?: string;
  billedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  ingredientsDeducted?: boolean;
}

export type PaymentMode = "cash" | "upi" | "card";

export interface Payment {
  id: string;
  mode: PaymentMode;
  amount: number;
  reference?: string;
  at: string;
}

export type DiscountState = "none" | "pending" | "approved" | "rejected";

export interface BillLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Bill {
  id: string;
  code: string;
  orderId: string;
  tableNumber?: number;
  lines: BillLine[];
  subtotal: number;
  discountPct: number;
  discountState: DiscountState;
  discountRequestedBy?: string;
  discountApprovedBy?: string;
  discountAmount: number;
  gstPct: number;
  gstAmount: number;
  grandTotal: number;
  status: "unpaid" | "paid";
  payments: Payment[];
  createdAt: string;
  createdBy: string;
  paidAt?: string;
}

export interface IngredientIssue {
  id: string;
  ingredientId: string;
  quantity: number;
  issuedTo: string;
  at: string;
  by: string;
}

export type WastageReason = "spoilage" | "spillage" | "other";

export interface Wastage {
  id: string;
  ingredientId: string;
  quantity: number;
  reason: WastageReason;
  at: string;
  by: string;
}

export type ConsumptionSource = "issue" | "wastage" | "order";

export interface ConsumptionLog {
  id: string;
  ingredientId: string;
  quantity: number;
  source: ConsumptionSource;
  date: string; // yyyy-mm-dd
  at: string;
}

export type POStatus = "generated" | "sent" | "partially_received" | "completed" | "cancelled";

export interface POLine {
  id: string;
  ingredientId: string;
  quantity: number; // in ingredient units, pack-rounded
  unitCost: number;
  received: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  date: string; // yyyy-mm-dd
  createdAt: string;
  lines: POLine[];
  status: POStatus;
  createdBy: string;
}

export interface InvoiceLine {
  ingredientId: string;
  quantity: number;
  price: number; // per unit
}

export interface Invoice {
  id: string;
  code: string;
  supplierInvoiceNo: string;
  poId?: string;
  supplierId: string;
  date: string;
  lines: InvoiceLine[];
  total: number;
  status: "pending" | "paid";
  stockReceived: boolean;
  chequeId?: string;
  createdAt: string;
  createdBy: string;
  paidAt?: string;
}

export interface Cheque {
  id: string;
  no: string;
  invoiceId: string;
  supplierId: string;
  payee: string;
  amount: number;
  date: string;
}

export type CashEntryType = "receipt" | "expense";

export interface CashBookEntry {
  id: string;
  no: number;
  date: string; // yyyy-mm-dd
  at: string;
  particulars: string;
  type: CashEntryType;
  mode: "cash" | "bank";
  amount: number;
  balanceAfter: number; // physical cash balance after this entry
  refType?: "bill" | "invoice" | "expense" | "opening" | "reconciliation";
  refId?: string;
}

export interface CashReconciliation {
  id: string;
  date: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
  by: string;
  note?: string;
  at: string;
}

export interface Report {
  id: string;
  category: "sales" | "expenses" | "inventory" | "purchases" | "cash";
  title: string;
  from?: string;
  to?: string;
  generatedAt: string;
  rows: Record<string, string | number>[];
}

export type NotificationType =
  | "low_stock"
  | "purchase_order"
  | "invoice_pending"
  | "payment_failed"
  | "discount_request"
  | "discount_decision"
  | "reconciliation"
  | "reservation"
  | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  at: string;
  read: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  details: string;
}

export interface Settings {
  restaurantName: string;
  restaurantAddress: string;
  gstRate: number; // percent
  coverageDays: number; // stock coverage for threshold
  consumptionWindowDays: number; // rolling window for average daily consumption
  lowStockAlerts: boolean;
  chequeStartNumber: number;
}

export interface Counters {
  order: number;
  bill: number;
  purchaseOrder: number;
  invoice: number;
  cheque: number;
  cashEntry: number;
  notification: number;
}

export interface RasData {
  version: number;
  lastStockCheck?: string;
  users: User[];
  suppliers: Supplier[];
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  priceChanges: PriceChange[];
  tables: RestaurantTable[];
  reservations: Reservation[];
  orders: Order[];
  bills: Bill[];
  ingredientIssues: IngredientIssue[];
  wastages: Wastage[];
  consumptionLogs: ConsumptionLog[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  cheques: Cheque[];
  cashBook: CashBookEntry[];
  reconciliations: CashReconciliation[];
  notifications: Notification[];
  auditLog: AuditEntry[];
  settings: Settings;
  counters: Counters;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  preparing: "Preparing",
  ready: "Ready to serve",
  served: "Served",
  billed: "Billed",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const ROLE_LABELS: Record<Role, string> = {
  manager: "Manager",
  clerk: "Sales Clerk",
  kitchen: "Kitchen Staff",
  stock: "Stock Keeper",
};
