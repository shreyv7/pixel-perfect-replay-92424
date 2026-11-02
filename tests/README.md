# RAS White Box Testing Suite

This directory contains the complete White Box (Structural) testing suite for the **Restaurant Automation System (RAS)**.

## Directory Structure

```
tests/
├── README.md                          # Quick start and directory overview
├── WHITE_BOX_TEST_SPECIFICATION.md    # Detailed academic specification (CFGs, Basis Paths, Master Table)
└── white-box/
    ├── billing-services.test.ts       # White-box tests for billing, discount clamping, and GST calculations
    ├── inventory-services.test.ts     # White-box tests for stock threshold, daily consumption, and stock status
    ├── procurement-services.test.ts   # White-box tests for reorder planning, pack-size ceiling, and supplier grouping
    ├── order-kitchen-deduction.test.ts# White-box tests for recipe calculations, stock deduction, and low-stock alerts
    ├── accounts-services.test.ts      # White-box tests for cash drawer balancing, tender filtering, and totals
    ├── validation-id-services.test.ts # White-box tests for item validation, sequence codes, and currency formatting
    ├── auth-role-permissions.test.ts  # White-box tests for RBAC permission matrices and route authorization
    └── table-reservation-logic.test.ts# White-box tests for 2-hour conflict detection and table state transitions
```

## Running the Tests

Execute all white box tests using Vitest:

```bash
# Run all tests once
npm run test

# Run tests in interactive watch mode
npm run test:watch
```
