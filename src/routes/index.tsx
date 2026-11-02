import { useLocation, useNavigate } from "react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard,
  ClipboardList,
  Armchair,
  BookOpen,
  Receipt,
  ChefHat,
  Boxes,
  Truck,
  Users,
  FileText,
  Wallet,
  ChartNoAxesCombined,
  Settings,
  Bell,
  LogOut,
  Search,
  Plus,
  Printer,
  Menu as MenuIcon,
} from "lucide-react";
import { useRas, ALL_MODULES, ROLE_MODULES, ROLE_HOME, type ModuleId } from "@/lib/ras/store";
import { ROLE_LABELS, type MenuItem, type PaymentMode, type RasData } from "@/lib/ras/types";
import {
  computeBillTotals,
  computeThreshold,
  computeReorderPlan,
  groupReorderBySupplier,
  cashBalance,
  orderTotal,
  round2,
  uid,
  stockStatus,
} from "@/lib/ras/services";
import { money, fmtDateTime, todayStr, dateStr } from "@/lib/ras/format";
import {
  PageHeader,
  KpiCard,
  SectionCard,
  LoadingScreen,
  UtensilsMark,
} from "@/components/ras/shared";

const names: Record<ModuleId, string> = {
  overview: "Overview",
  orders: "Orders",
  tables: "Tables & Reservations",
  menu: "Menu Management",
  billing: "Billing & Payments",
  kitchen: "Kitchen Display",
  inventory: "Inventory",
  "purchase-orders": "Purchase Orders",
  suppliers: "Suppliers",
  invoices: "Invoices",
  accounts: "Accounts & Cash Book",
  reports: "Reports",
  users: "User Management",
  settings: "Settings",
};
const icons: Record<ModuleId, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  orders: ClipboardList,
  tables: Armchair,
  menu: BookOpen,
  billing: Receipt,
  kitchen: ChefHat,
  inventory: Boxes,
  "purchase-orders": Truck,
  suppliers: Users,
  invoices: FileText,
  accounts: Wallet,
  reports: ChartNoAxesCombined,
  users: Users,
  settings: Settings,
};
const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";
const primary =
  "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";
const secondary =
  "rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent";
const card = "rounded-xl border border-border bg-card p-4 shadow-sm";
type Mutate = (fn: (d: RasData) => void) => void;
function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-accent px-2 py-1 text-xs font-semibold capitalize text-primary">
      {children}
    </span>
  );
}
export default function App() {
  const {
    data,
    ready,
    databaseStatus,
    databaseError,
    session,
    login,
    loginAsRole,
    logout,
    mutate,
    resetDemoData,
  } = useRas();
  const navigate = useNavigate();
  const location = useLocation();
  const pathModule = location.pathname.slice(1) as ModuleId;
  const module = ALL_MODULES.includes(pathModule) ? pathModule : "overview";
  const [search, setSearch] = useState(""),
    [notices, setNotices] = useState(false),
    [mobileNav, setMobileNav] = useState(false);
  useEffect(() => {
    if (
      session &&
      (!ALL_MODULES.includes(pathModule) || !ROLE_MODULES[session.role].includes(pathModule))
    )
      navigate(ROLE_HOME[session.role], { replace: true });
  }, [session, pathModule, navigate]);
  useEffect(() => {
    const today = todayStr();
    if (!ready || data.lastStockCheck === today) return;
    mutate((d) => {
      if (d.lastStockCheck === today) return;
      d.ingredients.forEach((ingredient) => {
        const { threshold } = computeThreshold(d.consumptionLogs, ingredient.id, d.settings, today);
        ingredient.threshold = threshold;
        if (
          d.settings.lowStockAlerts &&
          stockStatus(ingredient.currentStock, threshold) !== "healthy"
        ) {
          d.notifications.unshift({
            id: uid("notice"),
            type: "low_stock",
            title: `Low stock: ${ingredient.name}`,
            message: `${ingredient.currentStock} ${ingredient.unit} remaining; threshold ${threshold}.`,
            at: new Date().toISOString(),
            read: false,
          });
        }
      });
      d.lastStockCheck = today;
    });
  }, [ready, data.lastStockCheck, mutate]);
  if (!ready) return <LoadingScreen />;
  if (!session) return <Login login={login} loginAsRole={loginAsRole} users={data.users} />;
  if (!ALL_MODULES.includes(pathModule) || !ROLE_MODULES[session.role].includes(pathModule))
    return <LoadingScreen label="Opening your workspace…" />;
  const nav = (id: ModuleId) => {
    if (ROLE_MODULES[session.role].includes(id)) {
      navigate(`/${id}`);
      setSearch("");
      setMobileNav(false);
    }
  };
  const searchTerm = search.trim().toLowerCase();
  const globalMatches: { label: string; detail: string; module: ModuleId }[] = searchTerm
    ? [
        ...data.orders.map((order) => ({
          label: order.code,
          detail: order.items.map((item) => item.name).join(", "),
          module: "orders" as const,
        })),
        ...data.menuItems.map((item) => ({
          label: `${item.code} · ${item.name}`,
          detail: item.category,
          module: "menu" as const,
        })),
        ...data.ingredients.map((ingredient) => ({
          label: `${ingredient.code} · ${ingredient.name}`,
          detail: ingredient.category,
          module: "inventory" as const,
        })),
        ...data.purchaseOrders.map((po) => ({
          label: po.code,
          detail: data.suppliers.find((supplier) => supplier.id === po.supplierId)?.name ?? "",
          module: "purchase-orders" as const,
        })),
        ...data.suppliers.map((supplier) => ({
          label: `${supplier.code} · ${supplier.name}`,
          detail: supplier.phone,
          module: "suppliers" as const,
        })),
        ...data.invoices.map((invoice) => ({
          label: invoice.code,
          detail: data.suppliers.find((supplier) => supplier.id === invoice.supplierId)?.name ?? "",
          module: "invoices" as const,
        })),
        ...data.bills.map((bill) => ({
          label: bill.code,
          detail: `Bill · ${money(bill.grandTotal)}`,
          module: "billing" as const,
        })),
      ]
        .filter(
          (result) =>
            ROLE_MODULES[session.role].includes(result.module) &&
            `${result.label} ${result.detail}`.toLowerCase().includes(searchTerm),
        )
        .slice(0, 8)
    : [];
  const common = { data, mutate, sessionId: session.id };
  const screens: Record<ModuleId, ReactNode> = {
    overview: <Overview data={data} nav={nav} />,
    orders: <Orders {...common} search={search} manager={session.role === "manager"} />,
    tables: <Tables {...common} />,
    menu: <Menu {...common} search={search} />,
    billing: <Billing {...common} manager={session.role === "manager"} />,
    kitchen: <Kitchen {...common} />,
    inventory: <Inventory {...common} search={search} canManage={session.role !== "kitchen"} />,
    "purchase-orders": <PurchaseOrders {...common} />,
    suppliers: <Suppliers {...common} />,
    invoices: <Invoices {...common} />,
    accounts: <Accounts {...common} />,
    reports: <Reports data={data} />,
    users: <UserManagement {...common} />,
    settings: (
      <SettingsPage
        {...common}
        reset={resetDemoData}
        databaseStatus={databaseStatus}
        databaseError={databaseError}
      />
    ),
  };
  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <aside className="w-full shrink-0 border-r border-border bg-card md:sticky md:top-0 md:h-screen md:w-64 md:overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-border p-5">
          <span className="rounded-xl bg-primary p-2 text-primary-foreground">
            <UtensilsMark />
          </span>
          <div>
            <div className="font-display text-lg font-bold">RAS</div>
            <div className="text-xs text-muted-foreground">Restaurant operations</div>
          </div>
          <button
            className={`${secondary} ml-auto md:hidden`}
            aria-label="Toggle navigation"
            aria-expanded={mobileNav}
            onClick={() => setMobileNav((v) => !v)}
          >
            <MenuIcon size={18} />
          </button>
        </div>
        <nav className={`${mobileNav ? "grid" : "hidden"} grid-cols-2 gap-1 p-3 md:block`}>
          {ROLE_MODULES[session.role].map((id) => {
            const Icon = icons[id];
            return (
              <button
                key={id}
                onClick={() => nav(id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${module === id ? "bg-accent font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon size={17} />
                {names[id]}
              </button>
            );
          })}
        </nav>
        <div
          className={`${mobileNav ? "block" : "hidden"} p-4 text-xs text-muted-foreground md:block`}
        >
          Restaurant data syncs through Supabase when connected.
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-xs text-muted-foreground">Workspace / {names[module]}</div>
            <div className="font-semibold">{names[module]}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative order-last w-full lg:order-none lg:w-64">
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <Search size={16} />
                <input
                  aria-label="Global search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search across RAS"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
              {searchTerm && (
                <div className="absolute right-0 z-30 mt-2 w-full min-w-64 rounded-xl border bg-card p-2 shadow-xl">
                  {globalMatches.length ? (
                    globalMatches.map((result, index) => (
                      <button
                        key={`${result.module}-${result.label}-${index}`}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => nav(result.module)}
                      >
                        <span className="block font-semibold">{result.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {names[result.module]} · {result.detail}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No matching records</p>
                  )}
                </div>
              )}
            </div>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <div className="relative">
              <button
                className={secondary}
                aria-label="Notifications"
                onClick={() => setNotices(!notices)}
              >
                <Bell size={17} />
                {data.notifications.some((n) => !n.read) ? " •" : ""}
              </button>
              {notices && (
                <div className="absolute right-0 z-20 mt-2 max-h-96 w-80 overflow-auto rounded-xl border bg-card p-3 shadow-xl">
                  <div className="mb-2 font-semibold">Notifications</div>
                  {data.notifications.slice(0, 12).map((n) => (
                    <div key={n.id} className="border-t py-2 text-xs">
                      <b>{n.title}</b>
                      <p>{n.message}</p>
                    </div>
                  ))}
                  <button
                    className={secondary}
                    onClick={() => {
                      mutate((d) => d.notifications.forEach((n) => (n.read = true)));
                      setNotices(false);
                    }}
                  >
                    Mark all read
                  </button>
                </div>
              )}
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">{session.name}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABELS[session.role]}</div>
            </div>
            <button className={secondary} onClick={logout} title="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">{screens[module]}</main>
      </div>
    </div>
  );
}
function Login({
  login,
  loginAsRole,
  users,
}: {
  login: (u: string, p: string) => { ok: boolean; error?: string };
  loginAsRole: (r: "manager" | "clerk" | "kitchen" | "stock") => void;
  users: RasData["users"];
}) {
  const navigate = useNavigate();
  const [u, setU] = useState(""),
    [p, setP] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-5">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <span className="inline-flex rounded-xl bg-primary p-3 text-primary-foreground">
          <UtensilsMark />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold">Welcome to RAS</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Restaurant Automation System · Staff sign in
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const r = login(u, p);
            if (!r.ok) toast.error(r.error);
            else {
              const user = users.find(
                (candidate) => candidate.userId.toLowerCase() === u.trim().toLowerCase(),
              );
              if (user) navigate(ROLE_HOME[user.role], { replace: true });
            }
          }}
        >
          <label className="block text-sm">
            User ID
            <input
              className={`${field} mt-1`}
              value={u}
              onChange={(e) => setU(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              className={`${field} mt-1`}
              value={p}
              onChange={(e) => setP(e.target.value)}
              required
            />
          </label>
          <button className={`${primary} w-full`}>Sign in</button>
        </form>
        <div className="mt-7 border-t pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quick demo access
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["manager", "clerk", "kitchen", "stock"] as const).map((r) => (
              <button
                key={r}
                className={secondary}
                onClick={() => {
                  loginAsRole(r);
                  navigate(ROLE_HOME[r], { replace: true });
                }}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
function Overview({ data, nav }: { data: RasData; nav: (m: ModuleId) => void }) {
  const paid = data.bills.filter((b) => b.status === "paid"),
    todayBills = paid.filter((b) => b.paidAt && dateStr(b.paidAt) === todayStr()),
    sales = todayBills.reduce((s, b) => s + b.grandTotal, 0),
    low = data.ingredients.filter((i) => stockStatus(i.currentStock, i.threshold) !== "healthy");
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const day = dateStr(d.toISOString());
    return {
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      revenue: paid
        .filter((b) => b.paidAt && dateStr(b.paidAt) === day)
        .reduce((s, b) => s + b.grandTotal, 0),
      orders: data.orders.filter((order) => dateStr(order.placedAt) === day).length,
    };
  });
  return (
    <>
      <PageHeader
        title="Restaurant overview"
        description="Live operational snapshot from shared demo data."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Today's sales" value={money(sales)} icon={Wallet} />
        <KpiCard label="Total orders" value={String(data.orders.length)} icon={ClipboardList} />
        <KpiCard
          label="Average order value"
          value={money(paid.length ? paid.reduce((s, b) => s + b.grandTotal, 0) / paid.length : 0)}
          icon={Receipt}
        />
        <KpiCard
          label="Low stock ingredients"
          value={String(low.length)}
          icon={Boxes}
          tone="warning"
        />
        <KpiCard
          label="Pending invoices"
          value={String(data.invoices.filter((i) => i.status === "pending").length)}
          icon={FileText}
        />
        <KpiCard label="Cash balance" value={money(cashBalance(data))} icon={Wallet} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Sales overview" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="revenue" />
                <YAxis yAxisId="orders" orientation="right" allowDecimals={false} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "revenue" ? money(Number(value)) : String(value)
                  }
                />
                <Legend />
                <Area
                  yAxisId="revenue"
                  dataKey="revenue"
                  type="monotone"
                  stroke="#26734e"
                  fill="#d8ebdf"
                />
                <Area
                  yAxisId="orders"
                  dataKey="orders"
                  type="monotone"
                  stroke="#c1793c"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Quick actions">
          <div className="grid gap-2">
            {(["orders", "menu", "inventory", "purchase-orders", "reports"] as ModuleId[]).map(
              (m) => (
                <button className={`${secondary} text-left`} key={m} onClick={() => nav(m)}>
                  Open {names[m]} →
                </button>
              ),
            )}
          </div>
        </SectionCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Recent orders">
          <div className="space-y-2">
            {data.orders
              .slice(-6)
              .reverse()
              .map((o) => (
                <div key={o.id} className="flex justify-between border-b py-2 text-sm">
                  <span>
                    {o.code} · Table {data.tables.find((t) => t.id === o.tableId)?.number ?? "—"}
                  </span>
                  <span>
                    {money(orderTotal(o))} <Badge>{o.status}</Badge>
                  </span>
                </div>
              ))}
          </div>
        </SectionCard>
        <SectionCard title="Inventory alerts">
          <div className="space-y-2">
            {low.slice(0, 6).map((i) => (
              <div key={i.id} className="flex justify-between border-b py-2 text-sm">
                <span>{i.name}</span>
                <span>
                  {i.currentStock} / {i.threshold} {i.unit}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Top selling items">
          <div className="space-y-2">
            {data.menuItems
              .map((m) => {
                const sold = paid.flatMap((b) => b.lines).filter((l) => l.menuItemId === m.id);
                return {
                  id: m.id,
                  name: m.name,
                  qty: sold.reduce((s, l) => s + l.quantity, 0),
                  revenue: sold.reduce((s, l) => s + l.lineTotal, 0),
                };
              })
              .sort((a, b) => b.qty - a.qty)
              .slice(0, 5)
              .map((item, index) => (
                <div key={item.id} className="flex justify-between border-b py-2 text-sm">
                  <span>
                    {index + 1}. {item.name} · {item.qty} sold
                  </span>
                  <b>{money(item.revenue)}</b>
                </div>
              ))}
          </div>
        </SectionCard>
        <SectionCard title="Pending procurement">
          <p className="text-sm">
            {
              data.purchaseOrders.filter((p) => !["completed", "cancelled"].includes(p.status))
                .length
            }{" "}
            open purchase orders · {data.invoices.filter((i) => i.status === "pending").length}{" "}
            pending invoices
          </p>
          <div className="mt-3 space-y-2">
            {data.purchaseOrders
              .filter((p) => !["completed", "cancelled"].includes(p.status))
              .slice(-4)
              .map((p) => (
                <div key={p.id} className="flex justify-between border-b py-2 text-sm">
                  <span>
                    {p.code} · {data.suppliers.find((s) => s.id === p.supplierId)?.name}
                  </span>
                  <Badge>{p.status.replace("_", " ")}</Badge>
                </div>
              ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
function Orders({
  data,
  mutate,
  sessionId,
  search,
  manager,
}: {
  data: RasData;
  mutate: Mutate;
  sessionId: string;
  search: string;
  manager: boolean;
}) {
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [page, setPage] = useState(0),
    [table, setTable] = useState(""),
    [item, setItem] = useState(""),
    [qty, setQty] = useState(1),
    [lines, setLines] = useState<
      { menuItemId: string; name: string; unitPrice: number; qty: number }[]
    >([]);
  const startEdit = (orderId: string) => {
    const order = data.orders.find((o) => o.id === orderId);
    if (!order || !["placed", "preparing", "served"].includes(order.status)) return;
    setEditing(orderId);
    setTable(order.tableId ?? "");
    setLines(
      order.items.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.name,
        unitPrice: i.unitPrice,
        qty: i.quantity,
      })),
    );
    setOpen(true);
  };
  const add = () => {
    const found = data.menuItems.find(
      (m) => m.id === item || m.code.toLowerCase() === item.toLowerCase(),
    );
    if (!found || !found.available) return toast.error("Select a valid available menu item");
    if (!Number.isInteger(qty) || qty <= 0)
      return toast.error("Quantity must be a positive whole number");
    setLines((v) => {
      const existing = v.find((x) => x.menuItemId === found.id);
      return existing
        ? v.map((x) => (x.menuItemId === found.id ? { ...x, qty: x.qty + qty } : x))
        : [...v, { menuItemId: found.id, name: found.name, unitPrice: found.price, qty }];
    });
  };
  const save = () => {
    if (!lines.length) return toast.error("Add at least one item");
    if (lines.some((x) => !Number.isInteger(x.qty) || x.qty <= 0))
      return toast.error("Every item needs a positive whole-number quantity");
    if (
      table &&
      data.tables.find((t) => t.id === table)?.status === "occupied" &&
      data.tables.find((t) => t.id === table)?.orderId !== editing
    )
      return toast.error("Table is occupied");
    mutate((d) => {
      if (editing) {
        const order = d.orders.find((o) => o.id === editing);
        if (!order || ["billed", "paid", "cancelled"].includes(order.status)) return;
        const oldTable = d.tables.find((t) => t.orderId === editing);
        if (oldTable && oldTable.id !== table) {
          oldTable.status = "free";
          delete oldTable.orderId;
        }
        if (table) {
          const newTable = d.tables.find((t) => t.id === table)!;
          newTable.status = "occupied";
          newTable.orderId = editing;
        }
        if (table) order.tableId = table;
        else delete order.tableId;
        order.items = lines.map((x) => ({
          id: uid("line"),
          menuItemId: x.menuItemId,
          name: x.name,
          unitPrice: x.unitPrice,
          quantity: x.qty,
        }));
        d.auditLog.unshift({
          id: uid("audit"),
          at: new Date().toISOString(),
          actor: sessionId,
          action: "order_updated",
          details: order.code,
        });
        return;
      }
      const n = ++d.counters.order,
        id = uid("order");
      d.orders.push({
        id,
        code: `ORD-${String(n).padStart(4, "0")}`,
        ...(table ? { tableId: table } : {}),
        items: lines.map((x) => ({
          id: uid("line"),
          menuItemId: x.menuItemId,
          name: x.name,
          unitPrice: x.unitPrice,
          quantity: x.qty,
        })),
        status: "placed",
        placedAt: new Date().toISOString(),
        placedBy: sessionId,
      });
      d.auditLog.unshift({
        id: uid("audit"),
        at: new Date().toISOString(),
        actor: sessionId,
        action: "order_placed",
        details: `ORD-${String(n).padStart(4, "0")}`,
      });
      if (table) {
        const t = d.tables.find((t) => t.id === table)!;
        t.status = "occupied";
        t.orderId = id;
      }
    });
    setOpen(false);
    setEditing(null);
    setLines([]);
    setTable("");
    toast.success(editing ? "Order updated" : "Order placed");
  };
  const matchingOrders = data.orders
    .filter(
      (o) =>
        !search ||
        o.code.toLowerCase().includes(search.toLowerCase()) ||
        o.items.some((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    )
    .slice()
    .reverse();
  const totalPages = Math.max(1, Math.ceil(matchingOrders.length / 10));
  return (
    <>
      <PageHeader
        title="Orders"
        description="Place orders and follow them through kitchen and payment."
        actions={
          <button
            className={primary}
            onClick={() => {
              setEditing(null);
              setLines([]);
              setTable("");
              setOpen(!open);
            }}
          >
            <Plus size={15} className="inline" /> Create order
          </button>
        }
      />
      {open && (
        <div className={card}>
          <h2 className="mb-4 font-semibold">{editing ? "Edit order" : "New order"}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select className={field} value={table} onChange={(e) => setTable(e.target.value)}>
              <option value="">Takeaway / no table</option>
              {data.tables
                .filter((t) => t.status !== "occupied" || t.orderId === editing)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.number} · {t.capacity} seats
                  </option>
                ))}
            </select>
            <select className={field} value={item} onChange={(e) => setItem(e.target.value)}>
              <option value="">Choose menu item</option>
              {data.menuItems
                .filter((m) => m.available)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} · {m.name} · {money(m.price)}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="1"
                className={field}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
              <button className={secondary} onClick={add}>
                Add
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {lines.map((x) => (
              <div key={x.menuItemId} className="flex justify-between border-b py-2 text-sm">
                <span>
                  {x.name} ×{" "}
                  <input
                    aria-label={`Quantity for ${x.name}`}
                    className="w-16 rounded border p-1"
                    type="number"
                    min="1"
                    step="1"
                    value={x.qty}
                    onChange={(e) =>
                      setLines((v) =>
                        v.map((l) =>
                          l.menuItemId === x.menuItemId ? { ...l, qty: Number(e.target.value) } : l,
                        ),
                      )
                    }
                  />
                </span>
                <span>
                  {money(x.qty * x.unitPrice)}{" "}
                  <button
                    className="ml-3 text-destructive"
                    onClick={() => setLines((v) => v.filter((l) => l.menuItemId !== x.menuItemId))}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <b>Subtotal {money(lines.reduce((s, x) => s + x.qty * x.unitPrice, 0))}</b>
            <button className={primary} onClick={save}>
              {editing ? "Update order" : "Save order"}
            </button>
          </div>
        </div>
      )}
      <SectionCard title="Order history">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">Order</th>
                <th>Time</th>
                <th>Table</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {matchingOrders
                .slice(
                  Math.min(page, totalPages - 1) * 10,
                  (Math.min(page, totalPages - 1) + 1) * 10,
                )
                .map((o) => (
                  <tr key={o.id} className="border-b">
                    <td className="py-3 font-semibold">{o.code}</td>
                    <td>{fmtDateTime(o.placedAt)}</td>
                    <td>{data.tables.find((t) => t.id === o.tableId)?.number ?? "—"}</td>
                    <td>{o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</td>
                    <td>{money(orderTotal(o))}</td>
                    <td>
                      <Badge>{o.status}</Badge>
                    </td>
                    <td>
                      {["placed", "preparing", "served"].includes(o.status) && (
                        <button className={secondary} onClick={() => startEdit(o.id)}>
                          Edit
                        </button>
                      )}
                      {o.status === "placed" && (
                        <button
                          className={secondary}
                          onClick={() => {
                            if (!manager)
                              return toast.error(
                                "Manager authorization is required to cancel an order",
                              );
                            if (!confirm("Cancel this order?")) return;
                            mutate((d) => {
                              const x = d.orders.find((x) => x.id === o.id)!;
                              x.status = "cancelled";
                              x.cancelledAt = new Date().toISOString();
                              const t = d.tables.find((t) => t.orderId === o.id);
                              if (t) {
                                t.status = "free";
                                delete t.orderId;
                              }
                              d.auditLog.unshift({
                                id: uid("audit"),
                                at: new Date().toISOString(),
                                actor: sessionId,
                                action: "order_cancelled",
                                details: x.code,
                              });
                            });
                            toast.success("Order cancelled");
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button className={secondary} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {Math.min(page, totalPages - 1) + 1} of {totalPages}
          </span>
          <button
            className={secondary}
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </SectionCard>
    </>
  );
}
function Tables({ data, mutate, sessionId }: { data: RasData; mutate: Mutate; sessionId: string }) {
  const [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [when, setWhen] = useState(""),
    [party, setParty] = useState(2);
  const reserve = () => {
    const t = data.tables.find((t) => t.id === selected);
    if (
      !t ||
      !name.trim() ||
      !/^\d{10}$/.test(phone) ||
      !when ||
      party < 1 ||
      party > t.capacity ||
      t.status === "occupied"
    )
      return toast.error("Check table, name, 10-digit phone, time and party size");
    const time = new Date(when).getTime();
    if (time < Date.now()) return toast.error("Choose a future time");
    if (
      data.reservations.some(
        (r) =>
          r.tableId === selected &&
          r.status === "upcoming" &&
          Math.abs(new Date(r.dateTime).getTime() - time) < 2 * 60 * 60 * 1000,
      )
    )
      return toast.error("Reservation conflicts within two hours");
    mutate((d) => {
      d.reservations.push({
        id: uid("reservation"),
        tableId: selected,
        customerName: name.trim(),
        phone,
        dateTime: new Date(when).toISOString(),
        partySize: party,
        status: "upcoming",
        createdBy: sessionId,
      });
      d.tables.find((t) => t.id === selected)!.status = "reserved";
    });
    setSelected("");
    setName("");
    toast.success("Reservation saved");
  };
  return (
    <>
      <PageHeader
        title="Tables & reservations"
        description="Track seating and prevent conflicting reservations."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.tables.map((t) => (
          <div key={t.id} className={card}>
            <div className="flex justify-between">
              <b>Table {t.number}</b>
              <Badge>{t.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.capacity} seats</p>
            <p className="mt-2 text-xs">
              {data.reservations
                .filter((r) => r.tableId === t.id && r.status === "upcoming")
                .map((r) => `${r.customerName} · ${fmtDateTime(r.dateTime)}`)
                .join(", ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {t.status !== "occupied" && (
                <button className={secondary} onClick={() => setSelected(t.id)}>
                  Reserve
                </button>
              )}
              {t.status !== "occupied" && (
                <button
                  className={secondary}
                  onClick={() => {
                    if (t.status === "reserved" && !confirm("Seat this table's reservation now?"))
                      return;
                    mutate((d) => {
                      d.tables.find((x) => x.id === t.id)!.status = "occupied";
                      if (t.status === "reserved") {
                        const reservation = d.reservations.find(
                          (r) => r.tableId === t.id && r.status === "upcoming",
                        );
                        if (reservation) reservation.status = "completed";
                      }
                    });
                    toast.success("Table marked occupied");
                  }}
                >
                  Occupy
                </button>
              )}
              {t.status !== "free" && !t.orderId && (
                <button
                  className={secondary}
                  onClick={() => {
                    if (
                      t.status === "reserved" &&
                      !confirm("Free this table and cancel its upcoming reservations?")
                    )
                      return;
                    mutate((d) => {
                      d.tables.find((x) => x.id === t.id)!.status = "free";
                      d.reservations
                        .filter((r) => r.tableId === t.id && r.status === "upcoming")
                        .forEach((r) => (r.status = "cancelled"));
                    });
                    toast.success("Table freed");
                  }}
                >
                  Free
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div className={card}>
          <h2 className="mb-3 font-semibold">
            Reserve table {data.tables.find((t) => t.id === selected)?.number}
          </h2>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              className={field}
              placeholder="Customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={field}
              placeholder="10-digit phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className={field}
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <input
              className={field}
              type="number"
              min="1"
              value={party}
              onChange={(e) => setParty(Number(e.target.value))}
            />
          </div>
          <button className={`${primary} mt-3`} onClick={reserve}>
            Save reservation
          </button>
        </div>
      )}
    </>
  );
}
function Kitchen({ data, mutate }: { data: RasData; mutate: Mutate; sessionId: string }) {
  return (
    <>
      <PageHeader
        title="Kitchen display"
        description="Move active tickets from placed to served."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.orders
          .filter((o) => ["placed", "preparing"].includes(o.status))
          .map((o) => (
            <div key={o.id} className={card}>
              <div className="flex justify-between">
                <b>{o.code}</b>
                <Badge>{o.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Table {data.tables.find((t) => t.id === o.tableId)?.number ?? "Takeaway"} ·{" "}
                {fmtDateTime(o.placedAt)}
              </p>
              <div className="my-4 space-y-1">
                {o.items.map((i) => (
                  <p key={i.id} className="text-sm">
                    {i.quantity} × {i.name}
                  </p>
                ))}
              </div>
              <button
                className={primary}
                onClick={() => {
                  mutate((d) => {
                    const x = d.orders.find((x) => x.id === o.id)!;
                    if (x.status === "placed" && !x.acceptedAt) {
                      x.acceptedAt = new Date().toISOString();
                    } else if (x.status === "placed") {
                      x.status = "preparing";
                      x.startedAt = new Date().toISOString();
                    } else if (x.status === "preparing") {
                      x.status = "served";
                      x.servedAt = new Date().toISOString();
                    }
                  });
                  toast.success("Kitchen status updated");
                }}
              >
                {o.status === "placed"
                  ? o.acceptedAt
                    ? "Start preparing"
                    : "Accept order"
                  : "Mark served"}
              </button>
            </div>
          ))}
        {!data.orders.some((o) => ["placed", "preparing"].includes(o.status)) && (
          <p>No active kitchen tickets.</p>
        )}
      </div>
    </>
  );
}
function Menu({
  data,
  mutate,
  sessionId,
  search,
}: {
  data: RasData;
  mutate: Mutate;
  sessionId: string;
  search: string;
}) {
  const [edit, setEdit] = useState(""),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [price, setPrice] = useState(0),
    [category, setCategory] = useState<MenuItem["category"]>("Main Course"),
    [recipe, setRecipe] = useState(""),
    [categoryFilter, setCategoryFilter] = useState("");
  const load = (m?: MenuItem) => {
    setEdit(m?.id ?? "new");
    setName(m?.name ?? "");
    setCode(m?.code ?? "");
    setPrice(m?.price ?? 0);
    setCategory(m?.category ?? "Main Course");
    setRecipe(m?.recipe.map((r) => `${r.ingredientId}:${r.quantity}`).join(", ") ?? "");
  };
  const save = () => {
    if (
      !name.trim() ||
      !code.trim() ||
      !Number.isFinite(price) ||
      price <= 0 ||
      data.menuItems.some((m) => m.code.toLowerCase() === code.toLowerCase() && m.id !== edit)
    )
      return toast.error("Enter a unique code, name and positive price");
    let parsed: MenuItem["recipe"] = [];
    try {
      parsed = recipe
        .split(",")
        .filter(Boolean)
        .map((x) => {
          const [ingredientId, q] = x.trim().split(":");
          const quantity = Number(q);
          if (
            !data.ingredients.some((i) => i.id === ingredientId) ||
            !Number.isFinite(quantity) ||
            quantity <= 0
          )
            throw Error();
          return { ingredientId: ingredientId!, quantity };
        });
    } catch {
      return toast.error("Recipe format: ingredient ID:quantity, separated by commas");
    }
    mutate((d) => {
      if (edit === "new")
        d.menuItems.push({
          id: uid("menu"),
          code: code.trim(),
          name: name.trim(),
          price,
          category,
          recipe: parsed,
          available: true,
        });
      else {
        const m = d.menuItems.find((x) => x.id === edit)!;
        if (m.price !== price) {
          d.priceChanges.push({
            id: uid("price"),
            menuItemId: m.id,
            oldPrice: m.price,
            newPrice: price,
            at: new Date().toISOString(),
            by: sessionId,
          });
          d.auditLog.push({
            id: uid("audit"),
            at: new Date().toISOString(),
            actor: sessionId,
            action: "menu_price_change",
            details: `${m.name}: ${m.price} → ${price}`,
          });
        }
        Object.assign(m, { code: code.trim(), name: name.trim(), price, category, recipe: parsed });
      }
    });
    setEdit("");
    toast.success("Menu saved");
  };
  return (
    <>
      <PageHeader
        title="Menu management"
        description="Prices are snapshotted when an order is placed."
        actions={
          <button className={primary} onClick={() => load()}>
            <Plus size={15} className="inline" /> Add item
          </button>
        }
      />
      {edit && (
        <div className={card}>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              className={field}
              placeholder="Item code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className={field}
              placeholder="Item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={field}
              type="number"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <select
              className={field}
              value={category}
              onChange={(e) => setCategory(e.target.value as MenuItem["category"])}
            >
              {["Starters", "Main Course", "Breads", "Rice", "Desserts", "Beverages"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <label className="mt-3 block text-sm">
            Recipe (ingredient ID:quantity)
            <input
              className={field}
              value={recipe}
              onChange={(e) => setRecipe(e.target.value)}
              placeholder="ing_paneer:0.2, ing_tomato:0.15"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button className={primary} onClick={save}>
              Save item
            </button>
            <button className={secondary} onClick={() => setEdit("")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <select
        className={field + " max-w-xs"}
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
      >
        <option value="">All menu categories</option>
        {["Starters", "Main Course", "Breads", "Rice", "Desserts", "Beverages"].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.menuItems
          .filter(
            (m) =>
              (!search ||
                `${m.code} ${m.name} ${m.category}`.toLowerCase().includes(search.toLowerCase())) &&
              (!categoryFilter || m.category === categoryFilter),
          )
          .map((m) => (
            <div key={m.id} className={card}>
              <div className="flex justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {m.code} · {m.category}
                  </div>
                  <h3 className="font-semibold">{m.name}</h3>
                </div>
                <b>{money(m.price)}</b>
              </div>
              <p className="my-3 text-xs text-muted-foreground">
                Recipe:{" "}
                {m.recipe
                  .map(
                    (r) =>
                      `${data.ingredients.find((i) => i.id === r.ingredientId)?.name ?? r.ingredientId} ${r.quantity}`,
                  )
                  .join(", ") || "None"}
              </p>
              <div className="flex gap-2">
                <button className={secondary} onClick={() => load(m)}>
                  Edit
                </button>
                <button
                  className={secondary}
                  onClick={() =>
                    mutate((d) => {
                      d.menuItems.find((x) => x.id === m.id)!.available = !m.available;
                    })
                  }
                >
                  {m.available ? "Mark unavailable" : "Make available"}
                </button>
                <button
                  className={secondary}
                  onClick={() => {
                    if (confirm(`Delete ${m.name}?`))
                      mutate((d) => {
                        d.menuItems = d.menuItems.filter((x) => x.id !== m.id);
                      });
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>
      <SectionCard title="Price change history">
        <div className="space-y-2">
          {data.priceChanges
            .slice()
            .reverse()
            .map((change) => (
              <div key={change.id} className="flex flex-wrap justify-between border-b py-2 text-sm">
                <span>
                  {data.menuItems.find((m) => m.id === change.menuItemId)?.name ?? "Deleted item"} ·{" "}
                  {money(change.oldPrice)} → {money(change.newPrice)}
                </span>
                <span>{fmtDateTime(change.at)}</span>
              </div>
            ))}
        </div>
      </SectionCard>
    </>
  );
}
function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
function printSlip(title: string, body: string) {
  const win = window.open("", "_blank", "width=420,height=700");
  if (!win) return toast.error("Allow popups to print this document");
  win.document.write(
    `<!doctype html><html><head><title>${escapeHtml(title)}</title><style>body{font:14px system-ui;max-width:360px;margin:32px auto;color:#222}h1{font-size:20px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px dashed #ccc}td:last-child{text-align:right}footer{margin-top:24px;font-size:11px;color:#666}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(new Date().toLocaleString("en-IN"))}</p>${body}<footer>RAS demonstration document · No bank or payment gateway integration</footer></body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}
function receiptHtml(b: RasData["bills"][number], d: RasData) {
  return `<p>${escapeHtml(d.settings.restaurantName)} · ${escapeHtml(b.code)} · Table ${b.tableNumber ?? "Takeaway"}</p><table>${b.lines.map((l) => `<tr><td>${escapeHtml(l.name)} × ${l.quantity}</td><td>${money(l.lineTotal)}</td></tr>`).join("")}<tr><td>Subtotal</td><td>${money(b.subtotal)}</td></tr><tr><td>Discount</td><td>-${money(b.discountAmount)}</td></tr><tr><td>GST ${b.gstPct}%</td><td>${money(b.gstAmount)}</td></tr><tr><td><b>Total paid</b></td><td><b>${money(b.grandTotal)}</b></td></tr></table><p>Payment: ${b.payments.map((p) => `${p.mode.toUpperCase()} ${money(p.amount)}`).join(" + ")}</p>`;
}
function addCash(
  d: RasData,
  particulars: string,
  type: "receipt" | "expense",
  mode: "cash" | "bank",
  amount: number,
  refType: "bill" | "invoice" | "expense",
  refId: string,
) {
  if (
    d.cashBook.some(
      (e) => e.refType === refType && e.refId === refId && e.particulars === particulars,
    )
  )
    return;
  const previous = cashBalance(d);
  d.cashBook.push({
    id: uid("cash"),
    no: ++d.counters.cashEntry,
    date: todayStr(),
    at: new Date().toISOString(),
    particulars,
    type,
    mode,
    amount,
    balanceAfter: round2(
      previous + (mode === "cash" ? (type === "receipt" ? amount : -amount) : 0),
    ),
    refType,
    refId,
  });
}
function Billing({
  data,
  mutate,
  sessionId,
  manager,
}: {
  data: RasData;
  mutate: Mutate;
  sessionId: string;
  manager: boolean;
}) {
  const [selected, setSelected] = useState(""),
    [discount, setDiscount] = useState(0),
    [cash, setCash] = useState(0),
    [upi, setUpi] = useState(0),
    [cardPay, setCardPay] = useState(0);
  const bill = data.bills.find((b) => b.id === selected);
  const create = (orderId: string) => {
    const o = data.orders.find((o) => o.id === orderId);
    if (!o || o.status !== "served") return toast.error("Only served orders can be billed");
    mutate((d) => {
      const x = d.orders.find((o) => o.id === orderId)!;
      const totals = computeBillTotals(orderTotal(x), 0, d.settings.gstRate);
      const id = uid("bill");
      d.bills.push({
        id,
        code: `BILL-${String(++d.counters.bill).padStart(4, "0")}`,
        orderId: x.id,
        ...(x.tableId
          ? { tableNumber: d.tables.find((t) => t.id === x.tableId)?.number ?? 0 }
          : {}),
        lines: x.items.map((i) => ({ ...i, lineTotal: i.quantity * i.unitPrice })),
        ...totals,
        discountPct: 0,
        discountState: "none",
        gstPct: d.settings.gstRate,
        status: "unpaid",
        payments: [],
        createdAt: new Date().toISOString(),
        createdBy: sessionId,
      });
      x.status = "billed";
      x.billedAt = new Date().toISOString();
    });
    toast.success("Bill generated");
  };
  const requestDiscount = () => {
    if (!bill || discount <= 0 || discount > 100)
      return toast.error("Enter a percentage between 0 and 100");
    mutate((d) => {
      const b = d.bills.find((x) => x.id === bill.id)!;
      b.discountPct = discount;
      b.discountState = "pending";
      b.discountRequestedBy = sessionId;
      d.notifications.unshift({
        id: uid("notice"),
        type: "discount_request",
        title: "Discount approval requested",
        message: `${b.code}: ${discount}%`,
        at: new Date().toISOString(),
        read: false,
      });
    });
    toast.success("Manager approval requested");
  };
  const approve = (approved: boolean) => {
    if (!bill || !manager) return;
    mutate((d) => {
      const b = d.bills.find((x) => x.id === bill.id)!;
      b.discountState = approved ? "approved" : "rejected";
      b.discountApprovedBy = sessionId;
      Object.assign(b, computeBillTotals(b.subtotal, approved ? b.discountPct : 0, b.gstPct));
      d.auditLog.push({
        id: uid("audit"),
        at: new Date().toISOString(),
        actor: sessionId,
        action: "discount_decision",
        details: `${b.code}: ${approved ? "approved" : "rejected"}`,
      });
    });
  };
  const pay = () => {
    if (!bill || bill.status === "paid") return;
    const amounts: { mode: PaymentMode; amount: number }[] = [
      { mode: "cash", amount: cash },
      { mode: "upi", amount: upi },
      { mode: "card", amount: cardPay },
    ].filter((x) => x.amount > 0) as { mode: PaymentMode; amount: number }[];
    if (bill.discountState === "pending") return toast.error("Discount needs manager approval");
    if (
      amounts.some((x) => !Number.isFinite(x.amount)) ||
      round2(amounts.reduce((s, x) => s + x.amount, 0)) !== bill.grandTotal
    )
      return toast.error("Split payments must equal the bill total");
    mutate((d) => {
      const b = d.bills.find((x) => x.id === bill.id)!;
      b.status = "paid";
      b.paidAt = new Date().toISOString();
      d.auditLog.unshift({
        id: uid("audit"),
        at: b.paidAt,
        actor: sessionId,
        action: "bill_paid",
        details: b.code,
      });
      b.payments = amounts.map((x) => ({ ...x, id: uid("payment"), at: b.paidAt! }));
      d.orders.find((o) => o.id === b.orderId)!.status = "paid";
      const t = d.tables.find((t) => t.orderId === b.orderId);
      if (t) {
        t.status = "free";
        delete t.orderId;
      }
      amounts.forEach((x) =>
        addCash(
          d,
          `${b.code} ${x.mode}`,
          "receipt",
          x.mode === "cash" ? "cash" : "bank",
          x.amount,
          "bill",
          b.id,
        ),
      );
    });
    toast.success("Payment recorded; receipt ready");
  };
  return (
    <>
      <PageHeader
        title="Billing & payments"
        description="Simulated payment confirmation; print a local receipt."
      />
      <SectionCard title="Served orders awaiting a bill">
        <div className="flex flex-wrap gap-2">
          {data.orders
            .filter((o) => o.status === "served")
            .map((o) => (
              <button className={secondary} key={o.id} onClick={() => create(o.id)}>
                Generate bill · {o.code} · {money(orderTotal(o))}
              </button>
            ))}
          {!data.orders.some((o) => o.status === "served") && (
            <p className="text-sm text-muted-foreground">No served orders awaiting billing.</p>
          )}
        </div>
      </SectionCard>
      <SectionCard title="Bills">
        <div className="flex flex-wrap gap-2">
          {data.bills
            .slice()
            .reverse()
            .map((b) => (
              <button
                key={b.id}
                className={secondary}
                onClick={() => {
                  setSelected(b.id);
                  setDiscount(b.discountPct);
                  setCash(0);
                  setUpi(0);
                  setCardPay(0);
                }}
              >
                {b.code} · {money(b.grandTotal)} · {b.status}
              </button>
            ))}
        </div>
      </SectionCard>
      {bill && (
        <div className={card}>
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">{bill.code}</h2>
            <Badge>{bill.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtDateTime(bill.createdAt)} · Table {bill.tableNumber ?? "Takeaway"}
          </p>
          <div className="my-4 space-y-2">
            {bill.lines.map((l, i) => (
              <div key={i} className="flex justify-between border-b py-1 text-sm">
                <span>
                  {l.name} × {l.quantity} @ {money(l.unitPrice)}
                </span>
                <span>{money(l.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <b>{money(bill.subtotal)}</b>
            </div>
            <div className="flex justify-between">
              <span>Discount {bill.discountState}</span>
              <b>-{money(bill.discountAmount)}</b>
            </div>
            <div className="flex justify-between">
              <span>GST {bill.gstPct}%</span>
              <b>{money(bill.gstAmount)}</b>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg">
              <b>Total</b>
              <b>{money(bill.grandTotal)}</b>
            </div>
          </div>
          {bill.status === "unpaid" && (
            <>
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <label className="text-xs">
                  Discount %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={field}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                  />
                </label>
                <button className={secondary} onClick={requestDiscount}>
                  Request approval
                </button>
                {manager && bill.discountState === "pending" && (
                  <>
                    <button className={primary} onClick={() => approve(true)}>
                      Approve
                    </button>
                    <button className={secondary} onClick={() => approve(false)}>
                      Reject
                    </button>
                  </>
                )}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {(
                  [
                    ["Cash", cash, setCash],
                    ["UPI", upi, setUpi],
                    ["Card", cardPay, setCardPay],
                  ] as const
                ).map(([label, value, set]) => (
                  <label className="text-sm" key={label}>
                    {label}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={field}
                      value={value}
                      onChange={(e) => set(Number(e.target.value))}
                    />
                  </label>
                ))}
                <button className={primary} onClick={pay}>
                  Confirm payment
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Remaining: {money(round2(bill.grandTotal - cash - upi - cardPay))}. UPI and card
                confirmations are simulated.
              </p>
            </>
          )}
          {bill.status === "paid" && (
            <button
              className={`${secondary} mt-4`}
              onClick={() => printSlip("Restaurant receipt", receiptHtml(bill, data))}
            >
              <Printer size={15} className="inline" /> Print receipt
            </button>
          )}
        </div>
      )}
    </>
  );
}
function Inventory({
  data,
  mutate,
  sessionId,
  search,
  canManage,
}: {
  data: RasData;
  mutate: Mutate;
  sessionId: string;
  search: string;
  canManage: boolean;
}) {
  const [ingredient, setIngredient] = useState(""),
    [quantity, setQuantity] = useState(0),
    [kind, setKind] = useState<"issue" | "wastage">("issue"),
    [reason, setReason] = useState(""),
    [person, setPerson] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockForm, setStockForm] = useState({
    code: "",
    name: "",
    category: "Produce",
    unit: "kg" as RasData["ingredients"][number]["unit"],
    currentStock: 0,
    packSize: 1,
    unitCost: 0,
    supplierId: "",
  });
  const editStock = (id: string | null) => {
    const current = data.ingredients.find((i) => i.id === id);
    setEditing(id ?? "new");
    setStockForm(
      current
        ? {
            code: current.code,
            name: current.name,
            category: current.category,
            unit: current.unit,
            currentStock: current.currentStock,
            packSize: current.packSize,
            unitCost: current.unitCost,
            supplierId: current.supplierId,
          }
        : {
            code: "",
            name: "",
            category: "Produce",
            unit: "kg",
            currentStock: 0,
            packSize: 1,
            unitCost: 0,
            supplierId: data.suppliers[0]?.id ?? "",
          },
    );
  };
  const saveStock = () => {
    if (
      !stockForm.code.trim() ||
      !stockForm.name.trim() ||
      !stockForm.supplierId ||
      stockForm.currentStock < 0 ||
      stockForm.packSize <= 0 ||
      stockForm.unitCost < 0 ||
      data.ingredients.some(
        (i) => i.code.toLowerCase() === stockForm.code.toLowerCase() && i.id !== editing,
      )
    )
      return toast.error("Enter a unique code and valid stock details");
    mutate((d) => {
      if (editing === "new")
        d.ingredients.push({
          ...stockForm,
          id: uid("ingredient"),
          threshold: 0,
          createdAt: new Date().toISOString(),
        });
      else
        Object.assign(
          d.ingredients.find((i) => i.id === editing)!,
          stockForm,
        );
      d.suppliers.forEach((s) => {
        s.ingredientIds = d.ingredients.filter((i) => i.supplierId === s.id).map((i) => i.id);
      });
      d.auditLog.unshift({
        id: uid("audit"),
        at: new Date().toISOString(),
        actor: sessionId,
        action: editing === "new" ? "ingredient_added" : "ingredient_updated",
        details: stockForm.name,
      });
    });
    setEditing(null);
    toast.success("Ingredient saved");
  };
  const record = () => {
    const ing = data.ingredients.find((i) => i.id === ingredient);
    if (
      !ing ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > ing.currentStock ||
      !(kind === "issue" ? person : reason).trim()
    )
      return toast.error("Select an ingredient, valid quantity and required details");
    mutate((d) => {
      d.ingredients.find((i) => i.id === ingredient)!.currentStock = round2(
        ing.currentStock - quantity,
      );
      const at = new Date().toISOString();
      if (kind === "issue")
        d.ingredientIssues.push({
          id: uid("issue"),
          ingredientId: ingredient,
          quantity,
          issuedTo: person,
          at,
          by: sessionId,
        });
      else
        d.wastages.push({
          id: uid("waste"),
          ingredientId: ingredient,
          quantity,
          reason: reason as "spoilage" | "spillage" | "other",
          at,
          by: sessionId,
        });
      d.consumptionLogs.push({
        id: uid("consumption"),
        ingredientId: ingredient,
        quantity,
        source: kind,
        date: todayStr(),
        at,
      });
      d.auditLog.unshift({
        id: uid("audit"),
        at,
        actor: sessionId,
        action: kind === "issue" ? "ingredient_issued" : "wastage_recorded",
        details: `${ing.name}: ${quantity} ${ing.unit}`,
      });
    });
    setQuantity(0);
    toast.success("Stock updated");
  };
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock quantities and consumption are shared with purchasing."
        actions={
          canManage && (
            <button className={primary} onClick={() => editStock(null)}>
              Add ingredient
            </button>
          )
        }
      />
      {editing && (
        <div className={card}>
          <h2 className="mb-3 font-semibold">{editing === "new" ? "Add" : "Edit"} ingredient</h2>
          <div className="grid gap-3 md:grid-cols-4">
            {(["code", "name", "category"] as const).map((key) => (
              <input
                key={key}
                className={field}
                placeholder={key}
                value={stockForm[key]}
                onChange={(e) => setStockForm((v) => ({ ...v, [key]: e.target.value }))}
              />
            ))}
            <select
              className={field}
              value={stockForm.unit}
              onChange={(e) =>
                setStockForm((v) => ({ ...v, unit: e.target.value as typeof v.unit }))
              }
            >
              {["kg", "g", "litre", "ml", "piece", "pack"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            {(["currentStock", "packSize", "unitCost"] as const).map((key) => (
              <label key={key} className="text-xs">
                {key}
                <input
                  className={field}
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockForm[key]}
                  onChange={(e) => setStockForm((v) => ({ ...v, [key]: Number(e.target.value) }))}
                />
              </label>
            ))}
            <select
              className={field}
              value={stockForm.supplierId}
              onChange={(e) => setStockForm((v) => ({ ...v, supplierId: e.target.value }))}
            >
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button className={primary} onClick={saveStock}>
              Save
            </button>
            <button className={secondary} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className={card}>
        <h2 className="mb-3 font-semibold">Record stock movement</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            className={field}
            value={kind}
            onChange={(e) => setKind(e.target.value as "issue" | "wastage")}
          >
            <option value="issue">Ingredient issue</option>
            <option value="wastage">Wastage</option>
          </select>
          <select
            className={field}
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value)}
          >
            <option value="">Ingredient</option>
            {data.ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.currentStock} {i.unit}
              </option>
            ))}
          </select>
          <input
            className={field}
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          {kind === "issue" ? (
            <input
              className={field}
              placeholder="Issued to"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            />
          ) : (
            <select className={field} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Reason</option>
              <option value="spoilage">Spoilage</option>
              <option value="spillage">Spillage</option>
              <option value="other">Other</option>
            </select>
          )}
        </div>
        <button className={`${primary} mt-3`} onClick={record}>
          Record {kind}
        </button>
      </div>
      <SectionCard
        title="Stock register"
        actions={
          <select
            className={field}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {[...new Set(data.ingredients.map((i) => i.category))].map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Code</th>
                <th>Ingredient</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Pack</th>
                <th>Threshold</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.ingredients
                .filter(
                  (i) =>
                    (!search ||
                      `${i.name} ${i.code} ${i.category}`
                        .toLowerCase()
                        .includes(search.toLowerCase())) &&
                    (!categoryFilter || i.category === categoryFilter),
                )
                .map((i) => (
                  <tr key={i.id} className="border-b">
                    <td className="py-3">{i.code}</td>
                    <td className="font-semibold">{i.name}</td>
                    <td>{i.category}</td>
                    <td>
                      {i.currentStock} {i.unit}
                    </td>
                    <td>{i.packSize}</td>
                    <td>{i.threshold}</td>
                    <td>{data.suppliers.find((s) => s.id === i.supplierId)?.name}</td>
                    <td>
                      <Badge>{stockStatus(i.currentStock, i.threshold)}</Badge>
                    </td>
                    <td>
                      {canManage && (
                        <button className={secondary} onClick={() => editStock(i.id)}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <SectionCard title="Recent stock history">
        <div className="space-y-2">
          {[
            ...data.ingredientIssues.map((x) => ({
              id: x.id,
              at: x.at,
              ingredientId: x.ingredientId,
              quantity: x.quantity,
              sign: "-",
              kind: `Issued to ${x.issuedTo}`,
            })),
            ...data.wastages.map((x) => ({
              id: x.id,
              at: x.at,
              ingredientId: x.ingredientId,
              quantity: x.quantity,
              sign: "-",
              kind: `Wastage: ${x.reason}`,
            })),
            ...data.invoices.flatMap((invoice) =>
              invoice.lines.map((line) => ({
                id: `${invoice.id}-${line.ingredientId}`,
                at: invoice.createdAt,
                ingredientId: line.ingredientId,
                quantity: line.quantity,
                sign: "+",
                kind: `Received on ${invoice.code}`,
              })),
            ),
          ]
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, 15)
            .map((x) => (
              <div className="flex flex-wrap justify-between border-b py-2 text-sm" key={x.id}>
                <span>
                  {data.ingredients.find((i) => i.id === x.ingredientId)?.name} · {x.kind}
                </span>
                <span>
                  {x.sign}
                  {x.quantity} · {fmtDateTime(x.at)}
                </span>
              </div>
            ))}
        </div>
      </SectionCard>
    </>
  );
}
function PurchaseOrders({
  data,
  mutate,
  sessionId,
}: {
  data: RasData;
  mutate: Mutate;
  sessionId: string;
}) {
  const plan = computeReorderPlan(data, todayStr());
  const generate = () => {
    if (!plan.length) return toast.info("No ingredients need ordering today");
    if (!confirm(`Generate purchase orders for ${plan.length} ingredients?`)) return;
    mutate((d) => {
      groupReorderBySupplier(d, computeReorderPlan(d, todayStr())).forEach((group) => {
        d.purchaseOrders.push({
          id: uid("po"),
          code: `PO-${String(++d.counters.purchaseOrder).padStart(4, "0")}`,
          supplierId: group[0]!.supplierId,
          date: todayStr(),
          createdAt: new Date().toISOString(),
          lines: group.map((l) => ({
            id: uid("po-line"),
            ingredientId: l.ingredient.id,
            quantity: l.orderQty,
            unitCost: l.ingredient.unitCost,
            received: 0,
          })),
          status: "generated",
          createdBy: sessionId,
        });
        d.auditLog.unshift({
          id: uid("audit"),
          at: new Date().toISOString(),
          actor: sessionId,
          action: "purchase_order_generated",
          details: d.purchaseOrders.at(-1)!.code,
        });
      });
    });
    toast.success("Purchase orders generated");
  };
  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Three-day consumption average × coverage days, rounded to supplier pack size."
        actions={
          <button className={primary} onClick={generate}>
            Generate POs ({plan.length})
          </button>
        }
      />
      <SectionCard title="Reorder proposal">
        {plan.length ? (
          <div className="grid gap-2">
            {plan.map((l) => (
              <div
                key={l.ingredient.id}
                className="flex flex-wrap justify-between border-b py-2 text-sm"
              >
                <span>
                  {l.ingredient.name} · {data.suppliers.find((s) => s.id === l.supplierId)?.name}
                </span>
                <span>
                  Stock {l.currentStock} / threshold {l.threshold} · order {l.orderQty}{" "}
                  {l.ingredient.unit}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No new reorder lines today.</p>
        )}
      </SectionCard>
      <div className="grid gap-4 md:grid-cols-2">
        {data.purchaseOrders
          .slice()
          .reverse()
          .map((po) => (
            <div key={po.id} className={card}>
              <div className="flex justify-between">
                <b>{po.code}</b>
                <Badge>{po.status.replace("_", " ")}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {po.date} · {data.suppliers.find((s) => s.id === po.supplierId)?.name}
              </p>
              <div className="my-3 space-y-1">
                {po.lines.map((l) => (
                  <p key={l.id} className="text-sm">
                    {data.ingredients.find((i) => i.id === l.ingredientId)?.name} · {l.received}/
                    {l.quantity} · {money(l.quantity * l.unitCost)}
                  </p>
                ))}
              </div>
              <div className="flex gap-2">
                {po.status === "generated" && (
                  <button
                    className={secondary}
                    onClick={() =>
                      mutate((d) => {
                        d.purchaseOrders.find((x) => x.id === po.id)!.status = "sent";
                      })
                    }
                  >
                    Mark sent
                  </button>
                )}
                <button
                  className={secondary}
                  onClick={() =>
                    printSlip(
                      `Purchase order ${po.code}`,
                      `<p>${escapeHtml(data.suppliers.find((s) => s.id === po.supplierId)?.name ?? "")}</p><table>${po.lines.map((l) => `<tr><td>${escapeHtml(data.ingredients.find((i) => i.id === l.ingredientId)?.name ?? "")} × ${l.quantity}</td><td>${money(l.quantity * l.unitCost)}</td></tr>`).join("")}</table>`,
                    )
                  }
                >
                  Print PO
                </button>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
function Suppliers({ data, mutate }: { data: RasData; mutate: Mutate; sessionId: string }) {
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [address, setAddress] = useState(""),
    [edit, setEdit] = useState("");
  const save = () => {
    if (!name.trim() || !address.trim() || phone.replace(/\D/g, "").length !== 10)
      return toast.error("Enter a supplier name, address and 10-digit phone");
    const details = { name: name.trim(), phone: phone.trim(), address: address.trim() };
    mutate((d) => {
      if (edit)
        Object.assign(
          d.suppliers.find((s) => s.id === edit)!,
          details,
        );
      else
        d.suppliers.push({
          id: uid("supplier"),
          code: `SUP-${String(d.suppliers.length + 1).padStart(2, "0")}`,
          ...details,
          ingredientIds: [],
        });
    });
    setName("");
    setPhone("");
    setAddress("");
    setEdit("");
    toast.success("Supplier saved");
  };
  return (
    <>
      <PageHeader title="Suppliers" description="Directory used to group purchase orders." />
      <div className={card}>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className={field}
            placeholder="Supplier name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={field}
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className={field}
            placeholder="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <button className={`${primary} mt-3`} onClick={save}>
          {edit ? "Update" : "Add"} supplier
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.suppliers.map((s) => (
          <div className={card} key={s.id}>
            <b>{s.name}</b>
            <p className="text-xs text-muted-foreground">
              {s.code} · {s.phone} · {s.address}
            </p>
            <p className="my-2 text-sm">
              {data.ingredients
                .filter((i) => i.supplierId === s.id)
                .map((i) => i.name)
                .join(", ") || "No linked ingredients"}
            </p>
            <button
              className={secondary}
              onClick={() => {
                setEdit(s.id);
                setName(s.name);
                setPhone(s.phone);
                setAddress(s.address);
              }}
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
function Invoices({
  data,
  mutate,
  sessionId,
}: {
  data: RasData;
  mutate: Mutate;
  sessionId: string;
}) {
  const [poId, setPoId] = useState(""),
    [number, setNumber] = useState(""),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [prices, setPrices] = useState<Record<string, number>>({}),
    [invoiceDate, setInvoiceDate] = useState(todayStr());
  const po = data.purchaseOrders.find((p) => p.id === poId);
  const receive = () => {
    if (
      !po ||
      !number.trim() ||
      data.invoices.some((i) => i.supplierInvoiceNo.toLowerCase() === number.trim().toLowerCase())
    )
      return toast.error("Choose a PO and unique supplier invoice number");
    if (!invoiceDate || invoiceDate > todayStr()) return toast.error("Choose a valid invoice date");
    if (
      po.lines.some((l) => !Number.isFinite(quantities[l.id] ?? 0) || (quantities[l.id] ?? 0) < 0)
    )
      return toast.error("Quantities cannot be negative");
    const lines = po.lines
      .map((l) => ({
        ingredientId: l.ingredientId,
        quantity: Number(quantities[l.id] ?? 0),
        price: Number(prices[l.id] ?? l.unitCost),
      }))
      .filter((l) => l.quantity > 0);
    if (
      !lines.length ||
      lines.some(
        (l) =>
          !Number.isFinite(l.quantity) ||
          !Number.isFinite(l.price) ||
          l.price <= 0 ||
          l.price !== po.lines.find((x) => x.ingredientId === l.ingredientId)!.unitCost ||
          l.quantity >
            po.lines.find((x) => x.ingredientId === l.ingredientId)!.quantity -
              po.lines.find((x) => x.ingredientId === l.ingredientId)!.received,
      )
    )
      return toast.error("Quantities must be positive and within outstanding PO quantity");
    const total = round2(lines.reduce((s, l) => s + l.quantity * l.price, 0));
    mutate((d) => {
      const p = d.purchaseOrders.find((x) => x.id === po.id)!;
      const id = uid("invoice"),
        paid = cashBalance(d) >= total;
      const invoice = {
        id,
        code: `INV-${String(++d.counters.invoice).padStart(4, "0")}`,
        supplierInvoiceNo: number.trim(),
        poId: p.id,
        supplierId: p.supplierId,
        date: invoiceDate,
        lines,
        total,
        status: paid ? ("paid" as const) : ("pending" as const),
        stockReceived: true,
        createdAt: new Date().toISOString(),
        createdBy: sessionId,
        ...(paid ? { paidAt: new Date().toISOString() } : {}),
        chequeId: "" as string,
      };
      for (const l of lines) {
        d.ingredients.find((i) => i.id === l.ingredientId)!.currentStock = round2(
          d.ingredients.find((i) => i.id === l.ingredientId)!.currentStock + l.quantity,
        );
        p.lines.find((x) => x.ingredientId === l.ingredientId)!.received += l.quantity;
      }
      p.status = p.lines.every((l) => l.received >= l.quantity)
        ? "completed"
        : "partially_received";
      if (paid) {
        const chequeId = uid("cheque");
        invoice.chequeId = chequeId;
        d.cheques.push({
          id: chequeId,
          no: `CHQ-${String(++d.counters.cheque).padStart(4, "0")}`,
          invoiceId: id,
          supplierId: p.supplierId,
          payee: d.suppliers.find((s) => s.id === p.supplierId)!.name,
          amount: total,
          date: todayStr(),
        });
        addCash(d, `Invoice ${number}`, "expense", "cash", total, "invoice", id);
      } else
        d.notifications.unshift({
          id: uid("notice"),
          type: "invoice_pending",
          title: "Invoice pending",
          message: `Invoice ${number} needs ${money(total)}; insufficient cash balance.`,
          at: new Date().toISOString(),
          read: false,
        });
      d.invoices.push(invoice);
      d.auditLog.unshift({
        id: uid("audit"),
        at: new Date().toISOString(),
        actor: sessionId,
        action: paid ? "invoice_paid" : "invoice_pending",
        details: invoice.code,
      });
    });
    setPoId("");
    setNumber("");
    setQuantities({});
    setPrices({});
    toast.success(
      total <= cashBalance(data)
        ? "Goods received and cheque prepared"
        : "Goods received; invoice pending",
    );
  };
  const settle = (invoiceId: string) => {
    const current = data.invoices.find((i) => i.id === invoiceId);
    if (!current || current.status !== "pending") return;
    if (cashBalance(data) < current.total) return toast.error("Cash balance is still insufficient");
    mutate((d) => {
      const invoice = d.invoices.find((i) => i.id === invoiceId)!;
      if (invoice.status !== "pending" || cashBalance(d) < invoice.total) return;
      const chequeId = uid("cheque");
      invoice.status = "paid";
      invoice.paidAt = new Date().toISOString();
      d.auditLog.unshift({
        id: uid("audit"),
        at: invoice.paidAt,
        actor: sessionId,
        action: "invoice_paid",
        details: invoice.code,
      });
      invoice.chequeId = chequeId;
      d.cheques.push({
        id: chequeId,
        no: `CHQ-${String(++d.counters.cheque).padStart(4, "0")}`,
        invoiceId,
        supplierId: invoice.supplierId,
        payee: d.suppliers.find((s) => s.id === invoice.supplierId)!.name,
        amount: invoice.total,
        date: todayStr(),
      });
      addCash(
        d,
        `Invoice ${invoice.supplierInvoiceNo}`,
        "expense",
        "cash",
        invoice.total,
        "invoice",
        invoice.id,
      );
    });
    toast.success("Invoice paid; simulated cheque ready");
  };
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Receive against a PO and simulate cheque payment when cash permits."
      />
      <div className={card}>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className={field}
            value={poId}
            onChange={(e) => {
              setPoId(e.target.value);
              setQuantities({});
              setPrices({});
            }}
          >
            <option value="">Select open purchase order</option>
            {data.purchaseOrders
              .filter((p) => !["completed", "cancelled"].includes(p.status))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {data.suppliers.find((s) => s.id === p.supplierId)?.name}
                </option>
              ))}
          </select>
          <input
            className={field}
            placeholder="Supplier invoice number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <label className="text-xs">
            Invoice date
            <input
              type="date"
              max={todayStr()}
              className={field}
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </label>
        </div>
        {po && (
          <div className="mt-3 grid gap-2">
            {po.lines
              .filter((l) => l.received < l.quantity)
              .map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  {data.ingredients.find((i) => i.id === l.ingredientId)?.name} · remaining{" "}
                  {l.quantity - l.received}
                  <input
                    type="number"
                    min="0"
                    max={l.quantity - l.received}
                    step="0.01"
                    className={`${field} max-w-32`}
                    value={quantities[l.id] ?? 0}
                    onChange={(e) =>
                      setQuantities((v) => ({ ...v, [l.id]: Number(e.target.value) }))
                    }
                  />
                  <label className="text-xs">
                    Unit price
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${field} max-w-32`}
                      value={prices[l.id] ?? l.unitCost}
                      onChange={(e) => setPrices((v) => ({ ...v, [l.id]: Number(e.target.value) }))}
                    />
                  </label>
                </div>
              ))}
          </div>
        )}
        <button className={`${primary} mt-3`} onClick={receive}>
          Receive goods & process invoice
        </button>
      </div>
      <SectionCard title="Invoice history">
        <div className="space-y-2">
          {data.invoices
            .slice()
            .reverse()
            .map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
              >
                <span>
                  {i.code} · {i.supplierInvoiceNo} ·{" "}
                  {data.suppliers.find((s) => s.id === i.supplierId)?.name}
                  <span className="block text-xs text-muted-foreground">
                    {data.purchaseOrders.find((purchaseOrder) => purchaseOrder.id === i.poId)
                      ?.code ?? "PO unavailable"}{" "}
                    · {i.date}
                  </span>
                </span>
                <span>
                  {money(i.total)} · <Badge>{i.status}</Badge>{" "}
                  {i.status === "pending" && (
                    <button className={secondary} onClick={() => settle(i.id)}>
                      Pay when funded
                    </button>
                  )}
                  {i.chequeId && (
                    <button
                      className={secondary}
                      onClick={() =>
                        printSlip(
                          `Simulated cheque ${data.cheques.find((c) => c.id === i.chequeId)?.no ?? ""}`,
                          `<p>Pay to: ${escapeHtml(data.suppliers.find((s) => s.id === i.supplierId)?.name ?? "")}</p><h2>${money(i.total)}</h2><p>For invoice ${escapeHtml(i.supplierInvoiceNo)}</p>`,
                        )
                      }
                    >
                      Print cheque
                    </button>
                  )}
                </span>
              </div>
            ))}
        </div>
      </SectionCard>
    </>
  );
}
function Accounts({
  data,
  mutate,
  sessionId,
}: {
  data: RasData;
  mutate: Mutate;
  sessionId: string;
}) {
  const [count, setCount] = useState(0),
    [expected, setExpected] = useState(cashBalance(data)),
    [note, setNote] = useState(""),
    [expenseName, setExpenseName] = useState(""),
    [expenseAmount, setExpenseAmount] = useState(0);
  const balance = cashBalance(data);
  const recordExpense = () => {
    if (!expenseName.trim() || !Number.isFinite(expenseAmount) || expenseAmount <= 0)
      return toast.error("Enter an expense name and positive amount");
    if (expenseAmount > balance) return toast.error("Cash balance is insufficient");
    mutate((d) => {
      const id = uid("expense");
      addCash(d, expenseName.trim(), "expense", "cash", expenseAmount, "expense", id);
      d.auditLog.unshift({
        id: uid("audit"),
        at: new Date().toISOString(),
        actor: sessionId,
        action: "cash_expense",
        details: `${expenseName.trim()}: ${money(expenseAmount)}`,
      });
    });
    setExpenseName("");
    setExpenseAmount(0);
    toast.success("Cash expense recorded");
  };
  return (
    <>
      <PageHeader
        title="Accounts & cash book"
        description="Cash drawer balance excludes UPI and card receipts."
      />
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Cash balance" value={money(balance)} icon={Wallet} />
        <KpiCard
          label="Receipts"
          value={money(
            data.cashBook.filter((e) => e.type === "receipt").reduce((s, e) => s + e.amount, 0),
          )}
          icon={Receipt}
        />
        <KpiCard
          label="Expenses"
          value={money(
            data.cashBook.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0),
          )}
          icon={Wallet}
        />
        <KpiCard
          label="Pending"
          value={money(
            data.invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.total, 0),
          )}
          icon={FileText}
        />
      </div>
      <div className={card}>
        <h2 className="mb-3 font-semibold">Record cash expense</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Particulars
            <input
              className={field}
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              placeholder="Expense description"
            />
          </label>
          <label className="text-sm">
            Amount
            <input
              className={field}
              type="number"
              min="0.01"
              step="0.01"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(Number(e.target.value))}
            />
          </label>
          <button className={primary} onClick={recordExpense}>
            Record expense
          </button>
        </div>
      </div>
      <div className={card}>
        <h2 className="mb-3 font-semibold">Daily cash reconciliation</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Expected cash
            <input
              className={field}
              type="number"
              min="0"
              step="0.01"
              value={expected}
              onChange={(e) => setExpected(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            Actual counted cash
            <input
              className={field}
              type="number"
              min="0"
              step="0.01"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <input
            className={field + " max-w-xs"}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className={primary}
            onClick={() => {
              if (
                count < 0 ||
                expected < 0 ||
                !Number.isFinite(count) ||
                !Number.isFinite(expected)
              )
                return toast.error("Enter valid expected and counted amounts");
              if (
                data.reconciliations.some((reconciliation) => reconciliation.date === todayStr()) &&
                !confirm("Replace today's reconciliation?")
              )
                return;
              mutate((d) => {
                const record = {
                  date: todayStr(),
                  expectedCash: expected,
                  countedCash: count,
                  variance: round2(count - expected),
                  by: sessionId,
                  note,
                  at: new Date().toISOString(),
                };
                const existing = d.reconciliations.find(
                  (reconciliation) => reconciliation.date === record.date,
                );
                if (existing) Object.assign(existing, record);
                else d.reconciliations.push({ id: uid("recon"), ...record });
                d.auditLog.unshift({
                  id: uid("audit"),
                  at: new Date().toISOString(),
                  actor: sessionId,
                  action: "cash_reconciled",
                  details: todayStr(),
                });
              });
              toast.success("Reconciliation saved");
            }}
          >
            Reconcile
          </button>
        </div>
        <p className="mt-2 text-sm">
          Book balance: {money(balance)} · Variance: {money(count - expected)}
        </p>
      </div>
      <SectionCard title="Cash book">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">No.</th>
                <th>Date</th>
                <th>Particulars</th>
                <th>Type</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Cash balance</th>
              </tr>
            </thead>
            <tbody>
              {data.cashBook
                .slice()
                .reverse()
                .map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="py-2">{e.no}</td>
                    <td>{e.date}</td>
                    <td>{e.particulars}</td>
                    <td>{e.type}</td>
                    <td>{e.mode}</td>
                    <td>{money(e.amount)}</td>
                    <td>{money(e.balanceAfter)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
function Reports({ data }: { data: RasData }) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
  const bills = data.bills.filter((b) => b.status === "paid" && inRange(dateStr(b.paidAt!)));
  const expenses = data.cashBook.filter((e) => e.type === "expense" && inRange(e.date));
  const wastes = data.wastages.filter((w) => inRange(dateStr(w.at)));
  const purchaseOrders = data.purchaseOrders.filter((p) => inRange(p.date));
  const relevantConsumption = data.consumptionLogs.filter((log) => inRange(log.date));
  const reconciliations = data.reconciliations.filter((r) => inRange(r.date));
  const sales = bills.reduce((s, b) => s + b.grandTotal, 0);
  const dailySales = Object.entries(
    bills.reduce<Record<string, { orders: number; revenue: number }>>((days, bill) => {
      const date = dateStr(bill.paidAt!);
      const current = days[date] ?? { orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue = round2(current.revenue + bill.grandTotal);
      days[date] = current;
      return days;
    }, {}),
  ).sort(([a], [b]) => b.localeCompare(a));
  const monthly = Object.entries(
    [
      ...bills.map((bill) => ({
        date: dateStr(bill.paidAt!),
        sales: bill.grandTotal,
        expenses: 0,
      })),
      ...expenses.map((entry) => ({ date: entry.date, sales: 0, expenses: entry.amount })),
    ].reduce<Record<string, { sales: number; expenses: number }>>((months, entry) => {
      const key = entry.date.slice(0, 7);
      const current = months[key] ?? { sales: 0, expenses: 0 };
      current.sales = round2(current.sales + entry.sales);
      current.expenses = round2(current.expenses + entry.expenses);
      months[key] = current;
      return months;
    }, {}),
  ).sort(([a], [b]) => b.localeCompare(a));
  const itemSales = data.menuItems
    .map((menuItem) => {
      const lines = bills
        .flatMap((bill) => bill.lines)
        .filter((line) => line.menuItemId === menuItem.id);
      return {
        id: menuItem.id,
        name: menuItem.name,
        qty: lines.reduce((sum, line) => sum + line.quantity, 0),
        revenue: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      };
    })
    .filter((item) => item.qty > 0)
    .sort((a, b) => b.qty - a.qty);
  const rows = [
    ["Paid sales", String(bills.length), money(sales)],
    ["Expenses", String(expenses.length), money(expenses.reduce((s, e) => s + e.amount, 0))],
    [
      "Low stock",
      String(
        data.ingredients.filter((i) => stockStatus(i.currentStock, i.threshold) !== "healthy")
          .length,
      ),
      "—",
    ],
    ["Wastage", String(wastes.length), "—"],
    ["Purchase orders", String(purchaseOrders.length), "—"],
    [
      "Pending invoices",
      String(data.invoices.filter((i) => i.status === "pending").length),
      money(data.invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.total, 0)),
    ],
  ];
  const exportCsv = () => {
    const csvCell = (value: string | number | undefined) => {
      const raw = String(value ?? "");
      const safe = /^[=+@-]/.test(raw) && Number.isNaN(Number(raw)) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const detail = itemSales.map((item) => ["Item sales", item.name, item.qty, item.revenue]);
    const csv = [
      ["Metric", "Detail", "Count", "Amount"],
      ...rows.map((r) => [r[0], "", r[1], r[2]]),
      ...dailySales.map(([date, values]) => ["Daily sales", date, values.orders, values.revenue]),
      ...monthly.flatMap(([month, values]) => [
        ["Monthly sales", month, "", values.sales],
        ["Monthly expenses", month, "", values.expenses],
      ]),
      ...detail,
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "ras-report.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <PageHeader
        title="Reports"
        description="Operational summaries calculated from current data."
        actions={
          <button className={primary} onClick={exportCsv}>
            Export CSV
          </button>
        }
      />
      <div className={card}>
        <div className="flex gap-3">
          <label className="text-sm">
            From
            <input
              type="date"
              className={field}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            To
            <input
              type="date"
              className={field}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Dates filter sales, expenses, consumption, wastage, purchases and reconciliations. Current
          stock and pending invoices reflect live state.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((r) => (
          <div className={card} key={r[0]}>
            <div className="text-xs text-muted-foreground">{r[0]}</div>
            <div className="mt-2 text-2xl font-semibold">{r[1]}</div>
            <div className="text-sm">{r[2]}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Daily sales">
          {dailySales.length ? (
            dailySales.map(([date, values]) => (
              <div key={date} className="flex justify-between border-b py-2 text-sm">
                <span>
                  {date} · {values.orders} paid orders
                </span>
                <b>{money(values.revenue)}</b>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No paid sales in this date range.</p>
          )}
        </SectionCard>
        <SectionCard title="Monthly sales and expenses">
          {monthly.length ? (
            monthly.map(([month, values]) => (
              <div key={month} className="flex justify-between gap-3 border-b py-2 text-sm">
                <b>{month}</b>
                <span>
                  Sales {money(values.sales)} · Expenses {money(values.expenses)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No transactions in this date range.</p>
          )}
        </SectionCard>
      </div>
      <SectionCard title="Item-wise sales">
        <div className="grid gap-2">
          {itemSales.length ? (
            itemSales.map((item, index) => (
              <div key={item.id} className="flex justify-between border-b py-2 text-sm">
                <span>
                  {index + 1}. {item.name}
                </span>
                <span>
                  {item.qty} sold · {money(item.revenue)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No item sales in this date range.</p>
          )}
        </div>
      </SectionCard>
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Revenue by category">
          {["Starters", "Main Course", "Breads", "Rice", "Desserts", "Beverages"].map(
            (category) => {
              const ids = new Set(
                data.menuItems.filter((m) => m.category === category).map((m) => m.id),
              );
              const revenue = bills
                .flatMap((b) => b.lines)
                .filter((l) => ids.has(l.menuItemId))
                .reduce((s, l) => s + l.lineTotal, 0);
              return (
                <div className="flex justify-between border-b py-2 text-sm" key={category}>
                  <span>{category}</span>
                  <b>{money(revenue)}</b>
                </div>
              );
            },
          )}
        </SectionCard>
        <SectionCard title="Supplier expenditure and cheques">
          {data.suppliers.map((supplier) => {
            const invoices = data.invoices.filter(
              (i) =>
                i.supplierId === supplier.id &&
                i.status === "paid" &&
                inRange((i.paidAt ?? i.date).slice(0, 10)),
            );
            return (
              <div className="flex justify-between border-b py-2 text-sm" key={supplier.id}>
                <span>
                  {supplier.name} · {invoices.length} paid invoices
                </span>
                <b>{money(invoices.reduce((sum, i) => sum + i.total, 0))}</b>
              </div>
            );
          })}
          <p className="mt-3 text-xs text-muted-foreground">
            {data.cheques.filter((c) => inRange(c.date)).length} simulated cheques in range
          </p>
        </SectionCard>
        <SectionCard title="Inventory consumption and wastage">
          {data.ingredients.map((i) => {
            const consumed = relevantConsumption
              .filter((log) => log.ingredientId === i.id)
              .reduce((s, log) => s + log.quantity, 0);
            const wasted = wastes
              .filter((w) => w.ingredientId === i.id)
              .reduce((s, w) => s + w.quantity, 0);
            return (
              <div className="flex justify-between border-b py-2 text-sm" key={i.id}>
                <span>
                  {i.name} · stock {i.currentStock} {i.unit}
                </span>
                <span>
                  Consumed {round2(consumed)} · Waste {round2(wasted)}
                </span>
              </div>
            );
          })}
        </SectionCard>
        <SectionCard title="Purchases and cash reconciliation">
          {data.suppliers.map((supplier) => (
            <div key={supplier.id} className="flex justify-between border-b py-2 text-sm">
              <span>{supplier.name}</span>
              <span>{purchaseOrders.filter((p) => p.supplierId === supplier.id).length} POs</span>
            </div>
          ))}
          <div className="mt-3 border-t pt-3 text-sm">
            <b>{reconciliations.length} reconciliations</b>
            {reconciliations.map((r) => (
              <p key={r.id}>
                {r.date} · expected {money(r.expectedCash)} · counted {money(r.countedCash)} ·
                variance {money(r.variance)}
              </p>
            ))}
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Audit trail">
        <div className="space-y-2">
          {data.auditLog
            .filter((entry) => inRange(dateStr(entry.at)))
            .slice(0, 30)
            .map((entry) => (
              <div key={entry.id} className="flex justify-between gap-3 border-b py-2 text-sm">
                <span>
                  {entry.action} · {entry.details}
                </span>
                <span className="shrink-0 text-muted-foreground">{fmtDateTime(entry.at)}</span>
              </div>
            ))}
        </div>
      </SectionCard>
    </>
  );
}
function UserManagement({
  data,
  mutate,
  sessionId,
}: {
  data: RasData;
  mutate: Mutate;
  sessionId: string;
}) {
  const [id, setId] = useState(""),
    [name, setName] = useState(""),
    [role, setRole] = useState<"manager" | "clerk" | "kitchen" | "stock">("clerk"),
    [editingUserId, setEditingUserId] = useState("");
  const activeManagers = data.users.filter((user) => user.active && user.role === "manager").length;
  const saveUser = () => {
    if (!id.trim() || !name.trim()) return toast.error("Enter a user ID and employee name");
    if (editingUserId) {
      const existing = data.users.find((user) => user.id === editingUserId);
      if (!existing) return toast.error("Employee no longer exists");
      if (
        existing.active &&
        existing.role === "manager" &&
        role !== "manager" &&
        activeManagers <= 1
      )
        return toast.error("Keep at least one active manager");
      mutate((draft) => {
        const user = draft.users.find((candidate) => candidate.id === editingUserId)!;
        user.name = name.trim();
        user.role = role;
        draft.auditLog.unshift({
          id: uid("audit"),
          at: new Date().toISOString(),
          actor: sessionId,
          action: "employee_updated",
          details: user.userId,
        });
      });
      toast.success("Employee updated");
    } else {
      if (data.users.some((user) => user.userId.toLowerCase() === id.trim().toLowerCase()))
        return toast.error("User ID already exists");
      mutate((draft) =>
        draft.users.push({
          id: uid("user"),
          userId: id.trim(),
          password: "demo123",
          name: name.trim(),
          role,
          active: true,
        }),
      );
      toast.success("Employee created; demo password: demo123");
    }
    setId("");
    setName("");
    setRole("clerk");
    setEditingUserId("");
  };
  return (
    <>
      <PageHeader title="User management" description="Local demo accounts and role access." />
      <div className={card}>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className={field}
            placeholder="User ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={!!editingUserId}
          />
          <input
            className={field}
            placeholder="Employee name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className={field}
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            {(["manager", "clerk", "kitchen", "stock"] as const).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button className={`${primary} mt-3`} onClick={saveUser}>
          {editingUserId ? "Save employee" : "Add employee"}
        </button>
        {editingUserId && (
          <button
            className={`${secondary} ml-2`}
            onClick={() => {
              setEditingUserId("");
              setId("");
              setName("");
              setRole("clerk");
            }}
          >
            Cancel edit
          </button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.users.map((u) => (
          <div key={u.id} className={card}>
            <b>{u.name}</b>
            <p className="text-xs">
              {u.userId} · {ROLE_LABELS[u.role]} · {u.active ? "Active" : "Inactive"}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                className={secondary}
                onClick={() => {
                  setEditingUserId(u.id);
                  setId(u.userId);
                  setName(u.name);
                  setRole(u.role);
                }}
              >
                Edit
              </button>
              <select
                className={field + " max-w-36"}
                value={u.role}
                onChange={(e) => {
                  const nextRole = e.target.value as typeof u.role;
                  if (
                    u.active &&
                    u.role === "manager" &&
                    nextRole !== "manager" &&
                    activeManagers <= 1
                  )
                    return toast.error("Keep at least one active manager");
                  mutate((d) => {
                    d.users.find((x) => x.id === u.id)!.role = nextRole;
                  });
                  toast.success("Role updated");
                }}
              >
                {(["manager", "clerk", "kitchen", "stock"] as const).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <button
                className={secondary}
                onClick={() => {
                  if (u.active && u.id === sessionId)
                    return toast.error("You cannot deactivate your own account");
                  if (u.active && u.role === "manager" && activeManagers <= 1)
                    return toast.error("Keep at least one active manager");
                  if (u.active && !confirm(`Deactivate ${u.name}?`)) return;
                  mutate((d) => {
                    d.users.find((x) => x.id === u.id)!.active = !u.active;
                  });
                  toast.success(u.active ? "Employee deactivated" : "Employee activated");
                }}
              >
                {u.active ? "Deactivate" : "Activate"}
              </button>
              <button
                className={secondary}
                onClick={() => {
                  mutate((d) => {
                    d.users.find((x) => x.id === u.id)!.password = "demo123";
                  });
                  toast.success("Password reset to demo123");
                }}
              >
                Reset password
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
function SettingsPage({
  data,
  mutate,
  reset,
  databaseStatus,
  databaseError,
}: {
  data: RasData;
  mutate: Mutate;
  sessionId: string;
  reset: () => void;
  databaseStatus: "connecting" | "synced" | "saving" | "local" | "error";
  databaseError: string | null;
}) {
  const [name, setName] = useState(data.settings.restaurantName),
    [address, setAddress] = useState(data.settings.restaurantAddress),
    [alerts, setAlerts] = useState(data.settings.lowStockAlerts),
    [gst, setGst] = useState(data.settings.gstRate),
    [windowDays, setWindow] = useState(data.settings.consumptionWindowDays),
    [coverage, setCoverage] = useState(data.settings.coverageDays);
  return (
    <>
      <PageHeader title="Settings" description="Demo business rules and restaurant identity." />
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Database connection</h2>
            <p className="text-sm text-muted-foreground">
              {databaseStatus === "synced"
                ? "Restaurant data is synchronized with Supabase."
                : databaseStatus === "saving"
                  ? "Saving the latest changes to Supabase…"
                  : databaseStatus === "connecting"
                    ? "Connecting to Supabase…"
                    : "Using the browser cache until Supabase is available."}
            </p>
            {databaseError && <p className="mt-1 text-xs text-destructive">{databaseError}</p>}
          </div>
          <Badge>{databaseStatus.replace("local", "local fallback")}</Badge>
        </div>
      </div>
      <div className={card}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            Restaurant name
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-sm">
            Restaurant address
            <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="text-sm">
            GST rate (%)
            <input
              className={field}
              type="number"
              min="0"
              max="100"
              value={gst}
              onChange={(e) => setGst(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            Consumption window (days)
            <input
              className={field}
              type="number"
              min="1"
              value={windowDays}
              onChange={(e) => setWindow(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            Stock coverage (days)
            <input
              className={field}
              type="number"
              min="1"
              value={coverage}
              onChange={(e) => setCoverage(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} />{" "}
            Notify on low stock
          </label>
          <p className="text-sm text-muted-foreground">Currency: INR (₹)</p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className={primary}
            onClick={() => {
              if (
                !name.trim() ||
                !address.trim() ||
                !Number.isFinite(gst) ||
                gst < 0 ||
                gst > 100 ||
                !Number.isInteger(windowDays) ||
                windowDays < 1 ||
                !Number.isFinite(coverage) ||
                coverage < 1
              )
                return toast.error("Check settings values");
              mutate((d) => {
                Object.assign(d.settings, {
                  restaurantName: name,
                  restaurantAddress: address,
                  gstRate: gst,
                  consumptionWindowDays: windowDays,
                  coverageDays: coverage,
                  lowStockAlerts: alerts,
                });
                delete d.lastStockCheck;
              });
              toast.success("Settings saved");
            }}
          >
            Save settings
          </button>
          <button
            className={secondary}
            onClick={() => {
              if (confirm("Reset all shared demo data? This cannot be undone.")) {
                reset();
                toast.success("Demo data restored");
              }
            }}
          >
            Reset demo data
          </button>
        </div>
      </div>
    </>
  );
}
