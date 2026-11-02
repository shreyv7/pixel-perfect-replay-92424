# RAS — Restaurant Automation System

A Supabase-backed academic demonstration of restaurant operations. Built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui components, React Router, Lucide and Recharts. It includes role-specific access, orders, tables, kitchen tickets, billing, inventory, purchase orders, invoices, cash book, reports and settings. Data is seeded on first launch, shared through Supabase and cached in localStorage for offline fallback.

## Run locally

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (currently `http://127.0.0.1:8080/`). Run `npx tsc --noEmit`, `npm test`, and `npm run build` to verify the project.

## Supabase database

Copy `.env.example` to `.env.local` and enter the project URL and publishable key. Never put a Supabase secret key in a `VITE_` variable or commit it to the repository.

Apply [the database migration](supabase/migrations/20261102000000_create_ras_state.sql) through the Supabase SQL Editor, or link the project with the Supabase CLI and run:

```sh
npx supabase db push
```

The migration creates the `ras_state` JSONB record, Row Level Security policies for this shared academic demo and revision tracking. The app saves every mutation to Supabase and checks for changes from other browser sessions every five seconds. After the first successful connection, the header displays `Supabase synced`. If the table is unavailable, the app displays `Local fallback` and continues using its browser cache.

## Demo sign in

Use the quick role buttons on the login page, or these user IDs and passwords:

| Role          | User ID   | Password     |
| ------------- | --------- | ------------ |
| Manager       | `manager` | `manager123` |
| Sales Clerk   | `clerk`   | `clerk123`   |
| Kitchen Staff | `kitchen` | `kitchen123` |
| Stock Keeper  | `stock`   | `stock123`   |

These are simulated browser-local accounts. Payments and cheque printing are demonstration workflows, not integrations with a gateway or bank. The manager's Settings page can reset the local demo data.

## Demo walkthrough

1. Sign in as Manager and review the live dashboard, menu recipes and inventory thresholds.
2. Sign in as Sales Clerk, reserve a table and place an order. The Kitchen Staff account can accept, prepare and serve it.
3. Generate a bill for the served order. Request a discount, approve it as Manager, then record a cash, UPI or card split payment and print the receipt.
4. As Stock Keeper, record an ingredient issue or wastage, generate supplier-grouped purchase orders, receive goods against a PO and process its invoice.
5. Review the cash book, enter a daily reconciliation and inspect reports. Every change is synchronized to Supabase and appears across the other modules.

## Structure and scope

`src/lib/ras/types.ts` defines the shared data model, `services.ts` holds billing, stock and procurement calculations, `seed.ts` creates connected demo records, `repository.ts` handles Supabase access and `store.tsx` provides synchronized state and simulated role access. The dashboard and workflows are in `src/routes/index.tsx`; reusable UI is in `src/components/ras/` and `src/components/ui/`.

The app is an academic demo with simulated accounts, UPI/card confirmations and printable cheque representations. It has no external banking or payment integration. Direct module URLs are protected by the active demo role. Order cancellation requires the manager role. Use Settings → Reset demo data to restore the original sample records in Supabase.
