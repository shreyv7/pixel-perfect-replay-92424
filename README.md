# RAS — Restaurant Automation System

A local-first academic demonstration of restaurant operations. Built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui components, React Router, Lucide and Recharts. It includes role-specific access, orders, tables, kitchen tickets, billing, inventory, purchase orders, invoices, cash book, reports and settings. Data is seeded on first launch and saved in this browser's localStorage.

## Run locally

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (currently `http://127.0.0.1:8080/`). Run `npx tsc --noEmit`, `npm test`, and `npm run build` to verify the project.

## Demo sign in

Use the quick role buttons on the login page, or these user IDs and passwords:

| Role | User ID | Password |
| --- | --- | --- |
| Manager | `manager` | `manager123` |
| Sales Clerk | `clerk` | `clerk123` |
| Kitchen Staff | `kitchen` | `kitchen123` |
| Stock Keeper | `stock` | `stock123` |

These are simulated browser-local accounts. Payments and cheque printing are demonstration workflows, not integrations with a gateway or bank. The manager's Settings page can reset the local demo data.

## Demo walkthrough

1. Sign in as Manager and review the live dashboard, menu recipes and inventory thresholds.
2. Sign in as Sales Clerk, reserve a table and place an order. The Kitchen Staff account can accept, prepare and serve it.
3. Generate a bill for the served order. Request a discount, approve it as Manager, then record a cash, UPI or card split payment and print the receipt.
4. As Stock Keeper, record an ingredient issue or wastage, generate supplier-grouped purchase orders, receive goods against a PO and process its invoice.
5. Review the cash book, enter a daily reconciliation and inspect reports. Every change is saved in localStorage and appears across the other modules.

## Structure and scope

`src/lib/ras/types.ts` defines the shared data model, `services.ts` holds billing, stock and procurement calculations, `seed.ts` creates connected demo records and `store.tsx` provides local persistence and simulated role access. The dashboard and workflows are in `src/routes/index.tsx`; reusable UI is in `src/components/ras/` and `src/components/ui/`.

The app is an academic demo with simulated accounts, UPI/card confirmations and printable cheque representations. It has no external banking or payment integration. Direct module URLs are protected by the active demo role. Order cancellation requires the manager role. Data is specific to the browser profile used; use Settings → Reset demo data to restore the original sample records.
