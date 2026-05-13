---
title: Warehouses
---

# Warehouses

A **warehouse** is a physical (or logical) location stock lives at. Every `VariantStock` row pins to one warehouse + one variant, every `Shipment` has an origin warehouse, and the routing engine picks a warehouse per order based on availability + proximity. This page covers the `fulkruma.warehouses` namespace on the Node SDK: the four methods, their typed inputs, and the patterns most teams reach for. For the underlying HTTP surface and the full field tables, see [API: Warehouses](/docs/api/resources/warehouses); for the data model, see [Concepts &rarr; Warehouse](/docs/concepts).

## Namespace

`fulkruma.warehouses` &mdash; every method on this namespace:

```ts
fulkruma.warehouses.create(input)
fulkruma.warehouses.list()
fulkruma.warehouses.update(id, patch)
fulkruma.warehouses.archive(id)
```

There's no `get(id)` &mdash; you fetch a single warehouse by listing then filtering client-side. The list endpoint returns every warehouse in the workspace including archived ones, so a one-trip lookup is cheap.

## Methods

### `warehouses.create`

**Signature.** `fulkruma.warehouses.create(input): Promise<{ warehouse: Warehouse }>`

Creates a warehouse in the workspace the API key belongs to. Only `name` is required &mdash; everything else (address, city, postal, coordinates, phone, default flag) is optional and can be filled in later via `update`. The SDK does **not** auto-mint an `Idempotency-Key` for this call because the operation is naturally safe to repeat &mdash; warehouse names aren't uniquely constrained.

```ts
import { FulkrumaClient } from '@forjio/fulkruma-node';

const fulkruma = new FulkrumaClient({
  keyId: process.env.FULKRUMA_KEY_ID!,
  secret: process.env.FULKRUMA_KEY_SECRET!,
});

const { warehouse } = await fulkruma.warehouses.create({
  name: 'Jakarta DC-1',
  address: 'Jl. Sudirman No. 1',
  city: 'Jakarta',
  postal: '12190',
  lat: -6.2088,
  lng: 106.8456,
  phone: '+62211234567',
  isDefault: true,
});

console.log(warehouse.id); // → 'wh_01HXAB...'
```

<blockquote class="callout-note">

**Only one default per workspace.** Setting `isDefault: true` here automatically clears the flag on whichever warehouse currently holds it &mdash; the backend does the swap inside a single transaction. The default warehouse is the one that pre-selects in the portal and seeds new variant stock rows.

</blockquote>

### `warehouses.list`

**Signature.** `fulkruma.warehouses.list(): Promise<{ warehouses: Warehouse[] }>`

Returns every warehouse in the workspace, including archived ones. Filter on `archivedAt` to find active ones. The response is **not** paginated &mdash; we expect single-digit warehouse counts per merchant, so the list always fits in one response.

```ts
const { warehouses } = await fulkruma.warehouses.list();
const active = warehouses.filter((w) => !w.archivedAt);
for (const w of active) {
  console.log(w.id, w.name, w.city);
}
```

### `warehouses.update`

**Signature.** `fulkruma.warehouses.update(id, patch): Promise<{ warehouse: Warehouse }>`

PATCH semantics &mdash; only the fields you pass are touched. Pass an updated `isDefault: true` to promote a warehouse; the API will clear the flag on the previous default in the same transaction.

```ts
const { warehouse } = await fulkruma.warehouses.update('wh_01HX...', {
  phone: '+62217654321',
  lat: -6.2090,
  lng: 106.8460,
});
```

You can't move a warehouse to a different workspace by mutating `accountId`; it's a server-controlled column.

### `warehouses.archive`

**Signature.** `fulkruma.warehouses.archive(id): Promise<{ archived: boolean }>`

Soft-delete. The warehouse stays referenceable from historic shipments and stock movements (so audit trails keep working), but it no longer shows up in the routing pool, and you can't create new stock rows against it. Archiving is **not** reversible via the API &mdash; mint a new warehouse if you need to "un-archive".

```ts
await fulkruma.warehouses.archive('wh_01HX...');
```

If the warehouse still has active stock (`onHand > 0` on any variant), the API returns `409 conflict` &mdash; zero it out first via `stock.adjust` with a negative delta.

## Types

The shape returned by every method:

```ts
interface Warehouse {
  id: string;              // 'wh_...'
  accountId: string;       // workspace
  name: string;
  address: string | null;
  city: string | null;
  postal: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  isDefault: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

For the full field reference (validation rules on each input field, the meaning of each timestamp), see [API: Warehouses](/docs/api/resources/warehouses).

## Common patterns

### Bootstrap a default warehouse

If you don't know whether a workspace has a warehouse yet (first-run setup, fresh tenants), create-or-promote:

```ts
async function ensureDefault(name: string) {
  const { warehouses } = await fulkruma.warehouses.list();
  const active = warehouses.filter((w) => !w.archivedAt);
  if (active.length === 0) {
    return fulkruma.warehouses.create({ name, isDefault: true });
  }
  const def = active.find((w) => w.isDefault);
  return def ?? fulkruma.warehouses.update(active[0].id, { isDefault: true });
}
```

### Resolve a warehouse by city

Routing logic typically asks "which warehouse should fulfill this Jakarta order?":

```ts
async function warehouseForCity(city: string) {
  const { warehouses } = await fulkruma.warehouses.list();
  return warehouses
    .filter((w) => !w.archivedAt && w.city?.toLowerCase() === city.toLowerCase())
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))[0] ?? null;
}
```

For real proximity routing (use the `lat`/`lng` columns), do the haversine math client-side &mdash; we don't expose a server-side "nearest" query.

### Promote a new default

```ts
await fulkruma.warehouses.update('wh_new...', { isDefault: true });
// API atomically clears isDefault on the prior default — no race window.
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Missing `name`, bad coordinate range, postal too long. |
| `not_found` | 404 | Warehouse ID doesn't exist or lives in another workspace. |
| `conflict` | 409 | Archive attempted on a warehouse with live stock. |
| `forbidden` | 403 | Key lacks `fulkruma:warehouse:write` scope. |

Every one of these comes through as a `FulkrumaError` instance &mdash; see [Errors](/docs/sdk/node/errors) for the full handling guide.

## Next

- [Stock](/docs/sdk/node/resources/stock) &mdash; what lives in a warehouse.
- [Shipments](/docs/sdk/node/resources/shipments) &mdash; what leaves a warehouse.
- [Shipping](/docs/sdk/node/resources/shipping) &mdash; courier rate quotes from a warehouse origin.
- [API: Warehouses](/docs/api/resources/warehouses) &mdash; HTTP-level reference.
