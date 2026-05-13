---
title: Stock
---

# Stock

**Stock** is the per-variant, per-warehouse inventory ledger. Every variant has zero or more `VariantStock` rows (one per warehouse it lives at), and every change to those rows generates a `StockMovement` audit record. Reservations are short-lived holds that block checkout-bound inventory from being double-sold. This page covers the `fulkruma.stock` namespace. For HTTP-level fields, see [API: Stock](/docs/api/resources/stock); for the data model, see [Concepts &rarr; Stock](/docs/concepts).

## Namespace

`fulkruma.stock` &mdash; every method:

```ts
fulkruma.stock.levels(params?)
fulkruma.stock.movements(params?)
fulkruma.stock.reservations()
fulkruma.stock.adjust(input)
```

Four read paths + one mutation. The mutation (`adjust`) is the only way to change stock from the SDK &mdash; reservations are created server-side by checkout sessions, and movements are append-only.

## Methods

### `stock.levels`

**Signature.** `fulkruma.stock.levels(params?): Promise<{ stock: VariantStock[] }>`

Returns current on-hand and available levels for every (variant, warehouse) pair. Pass `variant_id` to scope to one variant across all warehouses.

```ts
import { FulkrumaClient } from '@forjio/fulkruma-node';

const fulkruma = new FulkrumaClient({
  keyId: process.env.FULKRUMA_KEY_ID!,
  secret: process.env.FULKRUMA_KEY_SECRET!,
});

const { stock } = await fulkruma.stock.levels({ variant_id: 'var_01HX...' });
for (const s of stock) {
  console.log(`${s.warehouseId}: ${s.available} available (${s.onHand} on hand, ${s.reserved} reserved)`);
}
```

`available = onHand - reserved` always. The server keeps this invariant inside the same transaction as every stock mutation, so you'll never see drift.

### `stock.movements`

**Signature.** `fulkruma.stock.movements(params?): Promise<{ movements: StockMovement[] }>`

Returns the append-only ledger of stock changes &mdash; every `adjust`, every checkout-driven reservation/release, every shipment-driven decrement. Pass `variant_id` to scope. Default page is the most recent 100 movements.

```ts
const { movements } = await fulkruma.stock.movements({ variant_id: 'var_01HX...' });
for (const m of movements) {
  console.log(m.createdAt, m.reason, m.delta);
}
```

Reasons: `purchase`, `sale`, `return`, `damage`, `audit`, `transfer_in`, `transfer_out`, `manual_adjust`. See [API: Stock](/docs/api/resources/stock#reasons) for the full vocabulary.

### `stock.reservations`

**Signature.** `fulkruma.stock.reservations(): Promise<{ reservations: StockReservation[] }>`

Returns currently-live reservations across the workspace. Reservations expire automatically after their `expiresAt` &mdash; the cleanup job releases them back to `available`. You normally read this for debugging "why is X showing 0 available when nothing's been sold?".

```ts
const { reservations } = await fulkruma.stock.reservations();
console.log(reservations.length, 'live holds');
```

There's no `reservations.create` &mdash; that's a checkout-session side effect on the Plugipay side.

### `stock.adjust`

**Signature.** `fulkruma.stock.adjust(input): Promise<{ stock: VariantStock; movement: StockMovement }>`

The one mutation. Atomically updates the `(variant, warehouse)` row by `delta` and writes a `StockMovement` audit entry in the same transaction. The SDK auto-mints an `Idempotency-Key` &mdash; replay-safe under network retries.

```ts
const { stock, movement } = await fulkruma.stock.adjust({
  variantId: 'var_01HX...',
  warehouseId: 'wh_01HX...',
  delta: 50,                  // positive = receive, negative = take out
  reason: 'purchase',
  note: 'PO-2026-118 received',
});
console.log('on hand now:', stock.onHand);
console.log('movement id:', movement.id);
```

<blockquote class="callout-warn">

**Negative deltas can't take `available` below zero.** If you try to subtract more than is currently free, the API returns `409 insufficient_stock` and rolls back the transaction &mdash; neither the row nor the movement is written. Use `stock.levels` first if you need to clamp.

</blockquote>

## Types

```ts
interface VariantStock {
  id: string;
  variantId: string;
  warehouseId: string;
  onHand: number;          // physical count
  reserved: number;        // held by live reservations
  available: number;       // onHand - reserved
  lowStockThreshold: number | null;
  updatedAt: string;
}

interface StockMovement {
  id: string;
  variantId: string;
  warehouseId: string;
  delta: number;           // signed; negative = decrement
  reason: StockMovementReason;
  note: string | null;
  referenceType: string | null;   // 'shipment' | 'checkout' | null
  referenceId: string | null;
  createdAt: string;
}

interface StockReservation {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  checkoutSessionId: string | null;
  expiresAt: string;
  createdAt: string;
}

type StockMovementReason =
  | 'purchase' | 'sale' | 'return' | 'damage'
  | 'audit' | 'transfer_in' | 'transfer_out' | 'manual_adjust';
```

## Common patterns

### Stock a brand-new variant

After `addVariant`, push the initial count via `adjust`:

```ts
await fulkruma.stock.adjust({
  variantId: 'var_01HX...',
  warehouseId: 'wh_01HX...',
  delta: 100,
  reason: 'purchase',
  note: 'Initial stock',
});
```

### Transfer between warehouses

Two adjusts in a transaction-friendly order &mdash; out first, in second, so you never accidentally double-count:

```ts
async function transferStock(variantId: string, fromWh: string, toWh: string, qty: number) {
  await fulkruma.stock.adjust({
    variantId, warehouseId: fromWh, delta: -qty, reason: 'transfer_out',
  });
  await fulkruma.stock.adjust({
    variantId, warehouseId: toWh, delta: qty, reason: 'transfer_in',
  });
}
```

If the first call succeeds but the second fails, you have a real problem &mdash; wrap with your own job-runner retry, and keep the originating ref via `note` so you can reconcile manually if needed.

### Audit count

Daily reconciliation against your warehouse management system:

```ts
async function reconcile(variantId: string, warehouseId: string, counted: number) {
  const { stock } = await fulkruma.stock.levels({ variant_id: variantId });
  const row = stock.find((s) => s.warehouseId === warehouseId);
  if (!row) return;
  const delta = counted - row.onHand;
  if (delta !== 0) {
    await fulkruma.stock.adjust({
      variantId, warehouseId, delta,
      reason: 'audit',
      note: `Reconciliation ${new Date().toISOString().slice(0, 10)}`,
    });
  }
}
```

### Detect low-stock variants

```ts
async function lowStockReport() {
  const { stock } = await fulkruma.stock.levels();
  const low = stock.filter((s) =>
    s.lowStockThreshold !== null && s.available <= s.lowStockThreshold,
  );
  return low;
}
```

`lowStockThreshold` lives on the variant; the server copies it onto the `VariantStock` row so you don't have to join.

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Missing `variantId`/`warehouseId`, bad `reason`, non-integer `delta`. |
| `not_found` | 404 | Variant or warehouse ID doesn't exist or is in another workspace. |
| `conflict` | 409 (`insufficient_stock`) | Negative delta would take `available` below zero. |
| `forbidden` | 403 | Key lacks `fulkruma:stock:write` scope. |

## Next

- [Shipments](/docs/sdk/node/resources/shipments) &mdash; outbound stock movements with carriers attached.
- [Warehouses](/docs/sdk/node/resources/warehouses) &mdash; where stock lives.
- [API: Stock](/docs/api/resources/stock) &mdash; HTTP reference.
