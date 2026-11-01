import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DiscountState, Invoice, Order, POStatus, StockStatus, TableStatus } from "@/lib/ras/types";

const ORDER_STYLES: Record<Order["status"], string> = {
  placed: "border-info/30 bg-info/10 text-info",
  preparing: "border-warning/40 bg-warning/15 text-warning",
  served: "border-primary/30 bg-accent text-accent-foreground",
  billed: "border-info/30 bg-info/10 text-info",
  paid: "border-success/30 bg-success/10 text-success",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function OrderStatusBadge({ status, className }: { status: Order["status"]; className?: string }) {
  const label = { placed: "Placed", preparing: "Preparing", served: "Served", billed: "Billed", paid: "Paid", cancelled: "Cancelled" }[status];
  return <Badge variant="outline" className={cn("font-medium capitalize", ORDER_STYLES[status], className)}>{label}</Badge>;
}

const STOCK_STYLES: Record<StockStatus, string> = {
  healthy: "border-success/30 bg-success/10 text-success",
  low: "border-warning/40 bg-warning/15 text-warning",
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StockStatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  const label = { healthy: "Healthy", low: "Low Stock", critical: "Critical" }[status];
  return <Badge variant="outline" className={cn("font-medium", STOCK_STYLES[status], className)}>{label}</Badge>;
}

const PO_STYLES: Record<POStatus, string> = {
  generated: "border-info/30 bg-info/10 text-info",
  sent: "border-warning/40 bg-warning/15 text-warning",
  partially_received: "border-warning/40 bg-warning/15 text-warning",
  completed: "border-success/30 bg-success/10 text-success",
  cancelled: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function POStatusBadge({ status, className }: { status: POStatus; className?: string }) {
  const label = { generated: "Generated", sent: "Sent", partially_received: "Partially Received", completed: "Completed", cancelled: "Cancelled" }[status];
  return <Badge variant="outline" className={cn("font-medium", PO_STYLES[status], className)}>{label}</Badge>;
}

export function InvoiceStatusBadge({ status, className }: { status: Invoice["status"]; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        status === "paid"
          ? "border-success/30 bg-success/10 text-success"
          : "border-warning/40 bg-warning/15 text-warning",
        className,
      )}
    >
      {status === "paid" ? "Paid" : "Pending"}
    </Badge>
  );
}

export function TableStatusBadge({ status, className }: { status: TableStatus; className?: string }) {
  const styles: Record<TableStatus, string> = {
    free: "border-success/30 bg-success/10 text-success",
    reserved: "border-info/30 bg-info/10 text-info",
    occupied: "border-warning/40 bg-warning/15 text-warning",
  };
  return <Badge variant="outline" className={cn("font-medium capitalize", styles[status], className)}>{status}</Badge>;
}

export function DiscountBadge({ state, className }: { state: DiscountState; className?: string }) {
  if (state === "none") return <Badge variant="outline" className={cn("bg-muted text-muted-foreground", className)}>No discount</Badge>;
  const styles: Record<Exclude<DiscountState, "none">, string> = {
    pending: "border-warning/40 bg-warning/15 text-warning",
    approved: "border-success/30 bg-success/10 text-success",
    rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  const label = { pending: "Pending approval", approved: "Approved", rejected: "Rejected" }[state];
  return <Badge variant="outline" className={cn("font-medium", styles[state], className)}>{label}</Badge>;
}

export function PaymentModeBadge({ mode, className }: { mode: "cash" | "upi" | "card"; className?: string }) {
  return <Badge variant="outline" className={cn("bg-muted font-medium uppercase", className)}>{mode}</Badge>;
}
