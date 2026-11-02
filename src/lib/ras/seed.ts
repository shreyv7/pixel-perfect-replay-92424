// Builds the demo dataset for RAS. Runs lazily in the browser (client-side)
// so it may use Date freely. All records are cross-linked so dashboards and
// reports reflect the seeded lifecycle.

import type {
  AuditEntry,
  Bill,
  BillLine,
  CashBookEntry,
  Cheque,
  ConsumptionLog,
  Ingredient,
  Invoice,
  MenuItem,
  Notification,
  Order,
  OrderItem,
  PurchaseOrder,
  RasData,
  RestaurantTable,
  Supplier,
  User,
} from "./types";
import { computeBillTotals, round2 } from "./services";

function iso(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateOnly(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildSeedData(): RasData {
  const users: User[] = [
    {
      id: "u1",
      userId: "manager",
      password: "manager123",
      name: "Amit Sharma",
      role: "manager",
      active: true,
    },
    {
      id: "u2",
      userId: "clerk",
      password: "clerk123",
      name: "Priya Nair",
      role: "clerk",
      active: true,
    },
    {
      id: "u3",
      userId: "kitchen",
      password: "kitchen123",
      name: "Ravi Kumar",
      role: "kitchen",
      active: true,
    },
    {
      id: "u4",
      userId: "stock",
      password: "stock123",
      name: "Sana Iqbal",
      role: "stock",
      active: true,
    },
  ];

  const suppliers: Supplier[] = [
    {
      id: "sup1",
      code: "SUP-01",
      name: "Dairy Fresh Farms",
      address: "14 Dairy Lane, Anand Nagar, Pune 411001",
      phone: "98220 11234",
      ingredientIds: ["ing_paneer", "ing_cream", "ing_butter", "ing_milk"],
    },
    {
      id: "sup2",
      code: "SUP-02",
      name: "Spice & Oil Bazaar",
      address: "88 Market Street, Camp, Pune 411001",
      phone: "98220 55221",
      ingredientIds: ["ing_spices", "ing_oil", "ing_chicken"],
    },
    {
      id: "sup3",
      code: "SUP-03",
      name: "Green Leaf Produce Co.",
      address: "Plot 7, Vegetable Market, Hadapsar, Pune 411028",
      phone: "98220 77345",
      ingredientIds: ["ing_tomato", "ing_onion", "ing_veg", "ing_coriander", "ing_chilli"],
    },
    {
      id: "sup4",
      code: "SUP-04",
      name: "Grain & Flour Mills",
      address: "22 Mill Road, Bhosari, Pune 411026",
      phone: "98220 90876",
      ingredientIds: ["ing_atta", "ing_rice", "ing_dal", "ing_sugar"],
    },
  ];

  const ingredient = (
    id: string,
    code: string,
    name: string,
    category: string,
    unit: Ingredient["unit"],
    currentStock: number,
    packSize: number,
    unitCost: number,
    supplierId: string,
    threshold: number,
  ): Ingredient => ({
    id,
    code,
    name,
    category,
    unit,
    currentStock,
    packSize,
    unitCost,
    supplierId,
    threshold,
    createdAt: iso(-30, 9),
  });

  const ingredients: Ingredient[] = [
    ingredient("ing_paneer", "ING-01", "Paneer", "Dairy", "kg", 8, 5, 320, "sup1", 20),
    ingredient("ing_tomato", "ING-02", "Tomato", "Produce", "kg", 25, 10, 40, "sup3", 16),
    ingredient("ing_cream", "ING-03", "Fresh Cream", "Dairy", "litre", 6, 2, 220, "sup1", 4.67),
    ingredient("ing_butter", "ING-04", "Butter", "Dairy", "kg", 4, 5, 480, "sup1", 9.33),
    ingredient(
      "ing_atta",
      "ING-05",
      "Wheat Flour (Atta)",
      "Grains",
      "kg",
      60,
      25,
      45,
      "sup4",
      21.33,
    ),
    ingredient("ing_rice", "ING-06", "Basmati Rice", "Grains", "kg", 45, 25, 110, "sup4", 18.67),
    ingredient("ing_dal", "ING-07", "Toor Dal", "Grains", "kg", 30, 10, 130, "sup4", 9.33),
    ingredient("ing_chicken", "ING-08", "Chicken", "Meat", "kg", 11, 5, 260, "sup2", 14.67),
    ingredient("ing_onion", "ING-09", "Onion", "Produce", "kg", 28, 10, 35, "sup3", 12),
    ingredient("ing_veg", "ING-10", "Mixed Vegetables", "Produce", "kg", 9, 5, 60, "sup3", 13.33),
    ingredient("ing_oil", "ING-11", "Sunflower Oil", "Oils", "litre", 18, 15, 150, "sup2", 6.67),
    ingredient(
      "ing_spices",
      "ING-12",
      "Spice Blend (Masala)",
      "Spices",
      "kg",
      3,
      2,
      500,
      "sup2",
      2.67,
    ),
    ingredient("ing_sugar", "ING-13", "Sugar", "Grains", "kg", 20, 10, 42, "sup4", 4.67),
    ingredient("ing_milk", "ING-14", "Milk", "Dairy", "litre", 22, 10, 56, "sup1", 12.67),
    ingredient(
      "ing_coriander",
      "ING-15",
      "Coriander Leaves",
      "Produce",
      "kg",
      2,
      1,
      80,
      "sup3",
      1.33,
    ),
    ingredient("ing_chilli", "ING-16", "Green Chilli", "Produce", "kg", 5, 2, 70, "sup3", 2),
  ];

  const mi = (
    id: string,
    code: string,
    name: string,
    category: MenuItem["category"],
    price: number,
    recipe: [string, number][],
  ): MenuItem => ({
    id,
    code,
    name,
    category,
    price,
    available: true,
    recipe: recipe.map(([ingId, qty]) => ({ ingredientId: ingId, quantity: qty })),
  });

  const menuItems: MenuItem[] = [
    mi("m1", "M-01", "Paneer Tikka", "Starters", 280, [
      ["ing_paneer", 0.15],
      ["ing_spices", 0.01],
      ["ing_butter", 0.02],
    ]),
    mi("m2", "M-02", "Chicken Tikka", "Starters", 320, [
      ["ing_chicken", 0.2],
      ["ing_spices", 0.015],
    ]),
    mi("m3", "M-03", "Crispy Veg Rolls", "Starters", 180, [
      ["ing_veg", 0.12],
      ["ing_oil", 0.02],
      ["ing_atta", 0.05],
    ]),
    mi("m4", "M-04", "Paneer Butter Masala", "Main Course", 320, [
      ["ing_paneer", 0.2],
      ["ing_tomato", 0.15],
      ["ing_cream", 0.05],
      ["ing_butter", 0.02],
    ]),
    mi("m5", "M-05", "Dal Tadka", "Main Course", 220, [
      ["ing_dal", 0.15],
      ["ing_butter", 0.01],
      ["ing_spices", 0.008],
    ]),
    mi("m6", "M-06", "Butter Chicken", "Main Course", 380, [
      ["ing_chicken", 0.25],
      ["ing_tomato", 0.12],
      ["ing_cream", 0.05],
      ["ing_butter", 0.03],
    ]),
    mi("m7", "M-07", "Veg Jalfrezi", "Main Course", 260, [
      ["ing_veg", 0.18],
      ["ing_tomato", 0.08],
      ["ing_oil", 0.02],
    ]),
    mi("m8", "M-08", "Butter Naan", "Breads", 60, [
      ["ing_atta", 0.12],
      ["ing_butter", 0.01],
    ]),
    mi("m9", "M-09", "Tandoori Roti", "Breads", 30, [["ing_atta", 0.1]]),
    mi("m10", "M-10", "Laccha Paratha", "Breads", 70, [
      ["ing_atta", 0.13],
      ["ing_butter", 0.015],
    ]),
    mi("m11", "M-11", "Veg Biryani", "Rice", 280, [
      ["ing_rice", 0.18],
      ["ing_veg", 0.1],
      ["ing_spices", 0.01],
      ["ing_oil", 0.02],
    ]),
    mi("m12", "M-12", "Chicken Biryani", "Rice", 360, [
      ["ing_rice", 0.18],
      ["ing_chicken", 0.2],
      ["ing_spices", 0.012],
      ["ing_oil", 0.02],
    ]),
    mi("m13", "M-13", "Jeera Rice", "Rice", 180, [
      ["ing_rice", 0.15],
      ["ing_butter", 0.01],
    ]),
    mi("m14", "M-14", "Gulab Jamun (2 pcs)", "Desserts", 120, [
      ["ing_milk", 0.05],
      ["ing_sugar", 0.03],
    ]),
    mi("m15", "M-15", "Masala Chaas", "Beverages", 80, [
      ["ing_milk", 0.2],
      ["ing_spices", 0.002],
    ]),
    mi("m16", "M-16", "Masala Chai", "Beverages", 60, [
      ["ing_milk", 0.15],
      ["ing_sugar", 0.02],
      ["ing_spices", 0.002],
    ]),
  ];

  const capacities = [4, 4, 2, 2, 4, 4, 6, 6, 8, 2, 4, 4];
  const tables: RestaurantTable[] = capacities.map((capacity, i) => ({
    id: `t${i + 1}`,
    number: i + 1,
    capacity,
    status: "free" as RestaurantTable["status"],
  }));

  // --- Consumption logs for the last 3 full days (drives thresholds) ---
  const daily: Record<string, [number, number, number]> = {
    ing_paneer: [10, 12, 8],
    ing_tomato: [9, 11, 10],
    ing_cream: [1.6, 2, 1.4],
    ing_butter: [3, 4, 3.4],
    ing_atta: [7, 8, 7.5],
    ing_rice: [6, 7, 6.5],
    ing_dal: [3, 3.5, 3.2],
    ing_chicken: [5, 6, 5.2],
    ing_onion: [4, 4.5, 4],
    ing_veg: [4.5, 5, 4.8],
    ing_oil: [2.2, 2.5, 2.1],
    ing_spices: [0.9, 1, 0.85],
    ing_sugar: [1.5, 1.7, 1.4],
    ing_milk: [4, 4.5, 4.2],
    ing_coriander: [0.4, 0.5, 0.45],
    ing_chilli: [0.7, 0.8, 0.65],
  };
  const consumptionLogs: ConsumptionLog[] = [];
  let logN = 0;
  for (const [ingId, days] of Object.entries(daily)) {
    days.forEach((qty, i) => {
      consumptionLogs.push({
        id: `cl${++logN}`,
        ingredientId: ingId,
        quantity: qty,
        source: "order",
        date: dateOnly(-(3 - i)),
        at: iso(-(3 - i), 22),
      });
    });
  }
  // Today's morning issue + wastage add to today's consumption.
  consumptionLogs.push(
    {
      id: "cl100",
      ingredientId: "ing_paneer",
      quantity: 2,
      source: "issue",
      date: dateOnly(0),
      at: iso(0, 8),
    },
    {
      id: "cl101",
      ingredientId: "ing_veg",
      quantity: 0.8,
      source: "wastage",
      date: dateOnly(0),
      at: iso(0, 9),
    },
  );

  // --- Orders, bills and payments over the last 7 days ---
  const orders: Order[] = [];
  const bills: Bill[] = [];
  const cashBook: CashBookEntry[] = [];
  const cheques: Cheque[] = [];
  let orderN = 0,
    billN = 0,
    payN = 0,
    cashN = 0;

  const pushCash = (
    dayOffset: number,
    atIso: string,
    particulars: string,
    type: CashBookEntry["type"],
    mode: CashBookEntry["mode"],
    amount: number,
    refType?: CashBookEntry["refType"],
    refId?: string,
  ) => {
    const prev = cashBook.filter((e) => e.mode === "cash").pop();
    const balance = round2(
      (prev?.balanceAfter ?? 0) + (mode === "cash" ? (type === "receipt" ? amount : -amount) : 0),
    );
    const entry: CashBookEntry = {
      id: `cb${++cashN}`,
      no: cashN,
      date: dateOnly(dayOffset),
      at: atIso,
      particulars,
      type,
      mode,
      amount: round2(amount),
      balanceAfter: round2(balance),
    };
    if (refType) entry.refType = refType;
    if (refId) entry.refId = refId;
    cashBook.push(entry);
  };

  pushCash(-30, iso(-30, 9), "Opening cash balance", "receipt", "cash", 15000, "opening");

  const makeOrder = (
    dayOffset: number,
    hour: number,
    itemPicks: [string, number][],
    tableId: string | undefined,
    status: Order["status"],
    payMode: "cash" | "upi" | "card" | null,
    discountPct = 0,
  ) => {
    const id = `o${++orderN}`;
    const code = `ORD-${String(orderN).padStart(4, "0")}`;
    const placedAt = iso(dayOffset, hour);
    const items: OrderItem[] = itemPicks.map(([mid, qty], i) => {
      const m = menuItems.find((x) => x.id === mid)!;
      return {
        id: `oi${orderN}_${i}`,
        menuItemId: mid,
        name: m.name,
        unitPrice: m.price,
        quantity: qty,
      };
    });
    const order: Order = { id, code, items, status, placedAt, placedBy: "Priya Nair" };
    if (tableId) order.tableId = tableId;
    if (["preparing", "served", "billed", "paid"].includes(status)) order.acceptedAt = placedAt;
    if (["served", "billed", "paid"].includes(status)) order.startedAt = iso(dayOffset, hour, 10);
    if (["served", "billed", "paid"].includes(status)) order.servedAt = iso(dayOffset, hour + 1);
    if (status === "cancelled") {
      order.cancelledAt = iso(dayOffset, hour + 1);
      order.cancelReason = "Guest left before serving";
    }
    orders.push(order);

    if (status === "paid") {
      const lines: BillLine[] = items.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: round2(i.quantity * i.unitPrice),
      }));
      const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
      const t = computeBillTotals(subtotal, discountPct, 5);
      const billId = `b${++billN}`;
      const billCode = `BILL-${String(billN).padStart(4, "0")}`;
      const paidAt = iso(dayOffset, hour + 2);
      const bill: Bill = {
        id: billId,
        code: billCode,
        orderId: id,
        lines,
        subtotal,
        discountPct,
        discountState: discountPct > 0 ? "approved" : "none",
        discountAmount: t.discountAmount,
        gstPct: 5,
        gstAmount: t.gstAmount,
        grandTotal: t.grandTotal,
        status: "paid",
        payments: [
          { id: `pay${++payN}`, mode: payMode ?? "cash", amount: t.grandTotal, at: paidAt },
        ],
        createdAt: iso(dayOffset, hour + 1, 30),
        createdBy: "Priya Nair",
        paidAt,
      };
      if (tableId) bill.tableNumber = tables.find((x) => x.id === tableId)!.number;
      if (discountPct > 0) {
        bill.discountRequestedBy = "Priya Nair";
        bill.discountApprovedBy = "Amit Sharma";
      }
      bills.push(bill);
      order.billedAt = iso(dayOffset, hour + 1, 30);
      pushCash(
        dayOffset,
        paidAt,
        `${billCode} — table sale`,
        "receipt",
        payMode === "cash" ? "cash" : "bank",
        t.grandTotal,
        "bill",
        billId,
      );
    }
    return order;
  };

  const combos: [string, number][][] = [
    [
      ["m4", 2],
      ["m8", 3],
      ["m15", 2],
    ],
    [
      ["m12", 2],
      ["m14", 2],
    ],
    [
      ["m5", 1],
      ["m9", 2],
      ["m16", 2],
    ],
    [
      ["m6", 1],
      ["m10", 2],
      ["m13", 1],
    ],
    [
      ["m1", 2],
      ["m4", 1],
      ["m8", 4],
    ],
    [
      ["m11", 1],
      ["m7", 1],
      ["m9", 2],
    ],
    [
      ["m2", 1],
      ["m5", 1],
      ["m16", 3],
    ],
  ];

  // Two to three paid orders per day for the previous 6 days.
  for (let d = 6; d >= 1; d--) {
    const count = 2 + (d % 2);
    for (let k = 0; k < count; k++) {
      const picks = combos[(d + k) % combos.length]!;
      const mode = (["cash", "upi", "card", "upi"] as const)[(d + k) % 4]!;
      makeOrder(-d, 12 + k * 2, picks, undefined, "paid", mode, (d + k) % 5 === 0 ? 10 : 0);
    }
  }

  // Today's live orders.
  makeOrder(
    0,
    11,
    [
      ["m4", 2],
      ["m9", 3],
    ],
    "t1",
    "preparing",
    null,
  );
  makeOrder(
    0,
    11,
    [
      ["m12", 2],
      ["m14", 1],
    ],
    "t3",
    "served",
    null,
  );
  makeOrder(
    0,
    12,
    [
      ["m1", 1],
      ["m5", 2],
      ["m16", 2],
    ],
    "t5",
    "billed",
    null,
  );
  makeOrder(
    0,
    12,
    [
      ["m7", 1],
      ["m11", 1],
    ],
    undefined,
    "placed",
    null,
  );
  const billedToday = orders[orders.length - 2]!;
  // The billed order waits on a manager discount approval.
  const bl: BillLine[] = billedToday.items.map((i) => ({
    menuItemId: i.menuItemId,
    name: i.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: round2(i.quantity * i.unitPrice),
  }));
  const bSub = round2(bl.reduce((s, l) => s + l.lineTotal, 0));
  const fullT = computeBillTotals(bSub, 0, 5);
  bills.push({
    id: `b${++billN}`,
    code: `BILL-${String(billN).padStart(4, "0")}`,
    orderId: billedToday.id,
    tableNumber: 5,
    lines: bl,
    subtotal: bSub,
    discountPct: 10,
    discountState: "pending",
    discountRequestedBy: "Priya Nair",
    discountAmount: 0,
    gstPct: 5,
    gstAmount: fullT.gstAmount,
    grandTotal: fullT.grandTotal,
    status: "unpaid",
    payments: [],
    createdAt: iso(0, 13, 10),
    createdBy: "Priya Nair",
  });
  makeOrder(0, 10, [["m3", 1]], undefined, "cancelled", null);

  // Table statuses based on live orders.
  const setOccupied = (tid: string, oid: string) => {
    const t = tables.find((x) => x.id === tid)!;
    t.status = "occupied";
    t.orderId = oid;
  };
  setOccupied("t1", orders.find((o) => o.tableId === "t1")!.id);
  setOccupied("t3", orders.find((o) => o.tableId === "t3")!.id);
  setOccupied("t5", billedToday.id);

  // --- Recent issues & wastage (recorded records) ---
  const ingredientIssues = [
    {
      id: "iss1",
      ingredientId: "ing_paneer",
      quantity: 2,
      issuedTo: "Kitchen — Morning Prep",
      at: iso(0, 8),
      by: "Sana Iqbal",
    },
    {
      id: "iss2",
      ingredientId: "ing_atta",
      quantity: 5,
      issuedTo: "Kitchen — Bread Station",
      at: iso(-1, 8),
      by: "Sana Iqbal",
    },
    {
      id: "iss3",
      ingredientId: "ing_oil",
      quantity: 2,
      issuedTo: "Kitchen — Frying",
      at: iso(-1, 8, 30),
      by: "Sana Iqbal",
    },
  ];
  const wastages = [
    {
      id: "w1",
      ingredientId: "ing_veg",
      quantity: 0.8,
      reason: "spoilage" as const,
      at: iso(0, 9),
      by: "Ravi Kumar",
    },
    {
      id: "w2",
      ingredientId: "ing_milk",
      quantity: 1,
      reason: "spillage" as const,
      at: iso(-2, 19),
      by: "Ravi Kumar",
    },
  ];

  // --- Purchase orders ---
  const purchaseOrders: PurchaseOrder[] = [
    {
      id: "po1",
      code: "PO-0001",
      supplierId: "sup1",
      date: dateOnly(-5),
      createdAt: iso(-5, 10),
      status: "sent",
      createdBy: "Sana Iqbal",
      lines: [
        { id: "pol1", ingredientId: "ing_paneer", quantity: 15, unitCost: 320, received: 15 },
        { id: "pol2", ingredientId: "ing_butter", quantity: 10, unitCost: 480, received: 10 },
      ],
    },
    {
      id: "po2",
      code: "PO-0002",
      supplierId: "sup3",
      date: dateOnly(-2),
      createdAt: iso(-2, 10),
      status: "partially_received",
      createdBy: "Sana Iqbal",
      lines: [
        { id: "pol3", ingredientId: "ing_tomato", quantity: 20, unitCost: 40, received: 20 },
        { id: "pol4", ingredientId: "ing_coriander", quantity: 3, unitCost: 80, received: 0 },
      ],
    },
  ];

  // --- Invoices & cheque ---
  const invoices: Invoice[] = [
    {
      id: "inv1",
      code: "INV-0001",
      supplierInvoiceNo: "DFF/2231",
      poId: "po1",
      supplierId: "sup1",
      date: dateOnly(-4),
      lines: [
        { ingredientId: "ing_paneer", quantity: 15, price: 320 },
        { ingredientId: "ing_butter", quantity: 10, price: 480 },
      ],
      total: round2(15 * 320 + 10 * 480),
      status: "paid",
      stockReceived: true,
      createdAt: iso(-4, 11),
      createdBy: "Sana Iqbal",
      paidAt: iso(-4, 12),
      chequeId: "chq1",
    },
    {
      id: "inv2",
      code: "INV-0002",
      supplierInvoiceNo: "GLP/8842",
      poId: "po2",
      supplierId: "sup3",
      date: dateOnly(-1),
      lines: [
        { ingredientId: "ing_tomato", quantity: 20, price: 40 },
        { ingredientId: "ing_coriander", quantity: 3, price: 80 },
      ],
      total: round2(20 * 40 + 3 * 80),
      status: "pending",
      stockReceived: true,
      createdAt: iso(-1, 15),
      createdBy: "Sana Iqbal",
    },
  ];
  cheques.push({
    id: "chq1",
    no: "000101",
    invoiceId: "inv1",
    supplierId: "sup1",
    payee: "Dairy Fresh Farms",
    amount: 9600,
    date: dateOnly(-4),
  });
  pushCash(
    -4,
    iso(-4, 12),
    "Cheque 000101 — Dairy Fresh Farms (INV-0001)",
    "expense",
    "cash",
    9600,
    "invoice",
    "inv1",
  );
  pushCash(-3, iso(-3, 10), "Kitchen gas cylinder refill", "expense", "cash", 1450, "expense");

  const reconciliations = [
    {
      id: "rec1",
      date: dateOnly(-1),
      expectedCash: 18400,
      countedCash: 18380,
      variance: -20,
      by: "Amit Sharma",
      note: "₹20 short — register float adjusted",
      at: iso(-1, 23),
    },
  ];

  const notifications: Notification[] = [
    {
      id: "n1",
      type: "low_stock",
      title: "Low stock: Paneer",
      message: "Paneer at 8 kg is below the reorder threshold of 20 kg.",
      at: iso(0, 7),
      read: false,
    },
    {
      id: "n2",
      type: "low_stock",
      title: "Critical stock: Coriander Leaves",
      message: "Coriander Leaves at 2 kg — below half of the reorder threshold.",
      at: iso(0, 7),
      read: false,
    },
    {
      id: "n3",
      type: "invoice_pending",
      title: "Invoice pending payment",
      message: "GLP/8842 (₹1,040.00) from Green Leaf Produce Co. is awaiting cheque clearance.",
      at: iso(-1, 15),
      read: false,
    },
    {
      id: "n4",
      type: "discount_request",
      title: "Discount approval requested",
      message: "Priya Nair requested a 10% discount on the bill for Table 5.",
      at: iso(0, 13, 10),
      read: false,
    },
    {
      id: "n5",
      type: "purchase_order",
      title: "Purchase order sent",
      message: "PO-0002 to Green Leaf Produce Co. was marked sent.",
      at: iso(-2, 11),
      read: true,
    },
  ];

  const auditLog: AuditEntry[] = [
    {
      id: "a1",
      at: iso(0, 8),
      actor: "Sana Iqbal",
      action: "Ingredient issue recorded",
      details: "2 kg Paneer issued to Kitchen — Morning Prep",
    },
    {
      id: "a2",
      at: iso(0, 9),
      actor: "Ravi Kumar",
      action: "Wastage recorded",
      details: "0.8 kg Mixed Vegetables — spoilage",
    },
    {
      id: "a3",
      at: iso(0, 11),
      actor: "Priya Nair",
      action: "Order placed",
      details: "ORD-0015 for Table 1",
    },
    {
      id: "a4",
      at: iso(0, 13, 10),
      actor: "Priya Nair",
      action: "Discount approval requested",
      details: "10% on the bill for Table 5",
    },
    {
      id: "a5",
      at: iso(-1, 23),
      actor: "Amit Sharma",
      action: "Cash reconciliation saved",
      details: "Variance −₹20.00 on " + dateOnly(-1),
    },
  ];

  return {
    version: 1,
    users,
    suppliers,
    ingredients,
    menuItems,
    priceChanges: [
      {
        id: "pc1",
        menuItemId: "m4",
        oldPrice: 300,
        newPrice: 320,
        at: iso(-12, 10),
        by: "Amit Sharma",
      },
      {
        id: "pc2",
        menuItemId: "m12",
        oldPrice: 340,
        newPrice: 360,
        at: iso(-9, 10),
        by: "Amit Sharma",
      },
    ],
    tables,
    reservations: [
      {
        id: "r1",
        tableId: "t8",
        customerName: "Kavita Deshpande",
        phone: "98765 43210",
        dateTime: iso(0, 20),
        partySize: 6,
        status: "upcoming",
        createdBy: "Priya Nair",
      },
      {
        id: "r2",
        tableId: "t6",
        customerName: "Rohit Malhotra",
        phone: "98123 45678",
        dateTime: iso(-1, 20),
        partySize: 6,
        status: "completed",
        createdBy: "Priya Nair",
      },
    ],
    orders,
    bills,
    ingredientIssues,
    wastages,
    consumptionLogs,
    purchaseOrders,
    invoices,
    cheques,
    cashBook,
    reconciliations,
    notifications,
    auditLog,
    settings: {
      restaurantName: "Saffron & Sage",
      restaurantAddress: "12 Baner Road, Pune 411045",
      gstRate: 5,
      coverageDays: 2,
      consumptionWindowDays: 3,
      lowStockAlerts: true,
      chequeStartNumber: 102,
    },
    counters: {
      order: orderN,
      bill: billN,
      purchaseOrder: 2,
      invoice: 2,
      cheque: 1,
      cashEntry: cashN,
      notification: notifications.length,
    },
  };
}
