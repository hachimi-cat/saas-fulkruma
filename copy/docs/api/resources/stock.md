---
title: Stock
---

# Stock

The **stock** resource is Fulkruma's inventory ledger: a per-variant, per-warehouse quantity table plus an append-only movement log and a reservation queue. Every change to on-hand quantity goes through one of three primitives:

- A **movement** records a `delta` (positive or negative) with a reason code. It's the canonical audit row &mdash; nothing else moves the level.
- A **reservation** soft-locks quantity for an in-flight shipment or pending checkout without decrementing the level. Reservations expire if not consumed.
- A **level** is the current on-hand quantity for a `(variantId, warehouseId)` pair. It's a derived view but materialised for query speed.

All requests on this page must be signed &mdash; see [**Authentication**](/docs/api/authentication). For the workspace's stock dashboard view, see [**Portal &rarr; Products &amp; stock**](/docs/portal/products).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/stock/levels` | List per-warehouse stock levels |
| `GET` | `/api/v1/stock/movements` | List stock movement audit trail |
| `GET` | `/api/v1/stock/reservations` | List active and historic reservations |
| `POST` | `/api/v1/stock/adjust` | Apply a delta to a level |

There is no `POST /reservations` &mdash; reservations are created internally by the shipment and checkout flows. There is no movement update or delete; the table is append-only.

### List stock levels

```
GET /api/v1/stock/levels
```

Returns up to 200 stock-level rows for the workspace, newest-updated first.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `variant_id` | string (`var_…`) | Filter to a single variant. Returns one row per warehouse where the variant has ever moved. |

**Response** &mdash; `200 OK`

```json
{
  "data": {
    "stock": [
      {
        "variantId": "var_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "warehouseId": "wh_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "quantity": 42,
        "updatedAt": "2026-05-12T10:42:00.123Z",
        "warehouse": {
          "id": "wh_01HX...",
          "name": "Main warehouse",
          "isDefault": true
        }
      }
    ]
  },
  "error": null,
  "meta": { "requestId": "req_01HX...", "timestamp": "..." }
}
```

```js
// Node
const { stock } = await fk.stock.levels({ variant_id: 'var_01HX...' });
```

```bash
fulkruma_curl GET '/api/v1/stock/levels?variant_id=var_01HXAB7K3M9N2P5QRS8TVWXY3Z'
```

### List stock movements

```
GET /api/v1/stock/movements
```

Returns up to 200 movement rows for the workspace, newest first. Each row is an append-only audit of one `delta` &mdash; created via `/adjust` or as a side-effect of shipment fulfilment.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `variant_id` | string (`var_…`) | Filter to a single variant. |

**Response shape**

```json
{
  "data": {
    "movements": [
      {
        "id": "mv_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "variantId": "var_01HX...",
        "warehouseId": "wh_01HX...",
        "delta": -3,
        "reason": "manual_adjust",
        "note": "Damaged stock written off after audit.",
        "createdBy": "usr_01HX...",
        "createdAt": "2026-05-12T10:42:00.123Z"
      }
    ]
  },
  "error": null,
  "meta": { ... }
}
```

### List reservations

```
GET /api/v1/stock/reservations
```

Returns up to 200 active or recently-historic reservations for the workspace. A reservation is **active** if `consumedAt` and `releasedAt` are both `null` and `expiresAt` is in the future; **consumed** if the linked shipment shipped; **released** if it was cancelled before shipping; **expired** if it timed out.

```json
{
  "data": {
    "reservations": [
      {
        "id": "rsv_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "variantId": "var_01HX...",
        "warehouseId": "wh_01HX...",
        "quantity": 2,
        "shipmentId": "ship_01HX...",
        "checkoutSessionId": "cs_01HX...",
        "expiresAt": "2026-05-12T11:42:00.000Z",
        "consumedAt": null,
        "releasedAt": null,
        "createdAt": "2026-05-12T10:42:00.123Z"
      }
    ]
  },
  ...
}
```

### Adjust stock

```
POST /api/v1/stock/adjust
```

Applies a signed delta to the `(variantId, warehouseId)` level inside a transaction, writing a `StockMovement` row and emitting a [`fulkruma.stock.adjusted.v1`](/docs/api/webhooks/events/fulkruma.stock.adjusted) event.

This is the only endpoint that mutates stock directly. Shipment fulfilment and refund-restock paths call into the same primitive internally.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `variantId` | string (`var_…`) | yes | The variant whose level you're moving. |
| `warehouseId` | string (`wh_…`) | yes | The warehouse holding the stock. Must be in the calling workspace; cross-workspace IDs return `404`. |
| `delta` | integer | yes | Signed delta. Positive to add, negative to subtract. Cannot move the level below 0 &mdash; see [`STOCK_INSUFFICIENT`](#errors). |
| `reason` | enum | yes | One of: `manual_adjust`, `initial_stock`, `transfer_in`, `transfer_out`, `damaged`, `returned_to_supplier`, `refund_restock`, `import`. Free-form `note` lets you add context; the enum is for filterable reporting. |
| `note` | string | no | Free-form audit note. |

**Response** &mdash; `200 OK`

```json
{
  "data": {
    "stock": {
      "variantId": "var_01HX...",
      "warehouseId": "wh_01HX...",
      "quantity": 39,
      "updatedAt": "2026-05-12T10:42:00.123Z"
    },
    "movement": {
      "id": "mv_01HX...",
      "variantId": "var_01HX...",
      "warehouseId": "wh_01HX...",
      "delta": -3,
      "reason": "damaged",
      "note": null,
      "createdAt": "2026-05-12T10:42:00.123Z"
    }
  },
  "error": null,
  "meta": { ... }
}
```

**Errors specific to this endpoint** {#errors}

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Missing fields, `reason` not in the enum, or `delta` not an integer. |
| `404` | `NOT_FOUND` | Warehouse doesn't exist in this workspace. (No 404 for a non-existent variant &mdash; the upsert creates a fresh `0` level on the first positive delta and a missing variant is caught at use-time.) |
| `500` | `NEGATIVE_STOCK` | Resulting quantity would go below 0. Currently surfaced as `500`; the next iteration will reclassify this as `409 STOCK_INSUFFICIENT`. |

```js
// Node
const { stock, movement } = await fk.stock.adjust({
  variantId: 'var_01HX...',
  warehouseId: 'wh_01HX...',
  delta: -3,
  reason: 'damaged',
  note: 'Box dropped during transit.',
});
```

```python
# Python
res = fk.stock.adjust(
    variant_id='var_01HX...',
    warehouse_id='wh_01HX...',
    delta=-3,
    reason='damaged',
    note='Box dropped during transit.',
)
```

```bash
fulkruma_curl POST '/api/v1/stock/adjust' \
  '{"variantId":"var_01HX...","warehouseId":"wh_01HX...","delta":-3,"reason":"damaged"}'
```

<blockquote class="callout-warn">

**Movements are append-only.** There is no `DELETE /api/v1/stock/movements/:id`. To correct a bad adjustment, post a compensating `delta` with the same magnitude and opposite sign, and reference the original movement ID in the `note`. The history stays intact and auditable.

</blockquote>

## The level object

| Field | Type | Description |
|---|---|---|
| `variantId` | string (`var_…`) | The variant. |
| `warehouseId` | string (`wh_…`) | The warehouse. |
| `quantity` | integer | On-hand quantity. Always &ge; 0. Excludes reservations &mdash; "available to ship" is `quantity - sum(active reservations.quantity)`. |
| `updatedAt` | string (ISO 8601 UTC) | Last movement timestamp. |
| `warehouse` | object | Inlined warehouse summary (`id`, `name`, `isDefault`). |

## The movement object

| Field | Type | Description |
|---|---|---|
| `id` | string (`mv_…`) | The movement ID. |
| `variantId` | string | The variant. |
| `warehouseId` | string | The warehouse. |
| `delta` | integer | The signed change. |
| `reason` | enum | The reason code. |
| `note` | string \| null | Free-form note. |
| `createdBy` | string \| null | The user ID (`usr_…`) of the actor, or `null` for system movements. |
| `createdAt` | string (ISO 8601 UTC) | Creation timestamp. |

## The reservation object

| Field | Type | Description |
|---|---|---|
| `id` | string (`rsv_…`) | The reservation ID. |
| `variantId` | string | The variant being held. |
| `warehouseId` | string | The warehouse holding the stock. |
| `quantity` | integer | Reserved quantity. |
| `shipmentId` | string \| null | The shipment this is held for, if any. |
| `checkoutSessionId` | string \| null | The originating Plugipay checkout session, if any. |
| `expiresAt` | string (ISO 8601 UTC) | When the reservation auto-releases if not consumed. Default 60 minutes from creation. |
| `consumedAt` | string \| null | When the linked shipment shipped (and the reservation became a real movement). |
| `releasedAt` | string \| null | When the reservation was manually released. |
| `createdAt` | string (ISO 8601 UTC) | Creation timestamp. |

## Events

| Event type | Fires on | Notes |
|---|---|---|
| `fulkruma.stock.adjusted.v1` | `POST /api/v1/stock/adjust` succeeds. Also fires for shipment-fulfilment and refund-restock paths. | Payload includes `quantityAfter` so consumers can sync state without a separate read. |

A `stock.low` event &mdash; for when a level falls to or below a variant's `lowStockThreshold` &mdash; is reserved in the catalog but **not currently emitted.** The dashboard surfaces low-stock status by polling.

See [**Webhooks**](/docs/api/resources/webhooks) for the event envelope and signature recipe.

## Common patterns

### Initial seeding

When you first onboard, post `initial_stock` movements for every variant + warehouse pair you carry on-hand. These show up as the first row in the movement log and give the audit trail a clean origin.

```bash
fulkruma_curl POST '/api/v1/stock/adjust' \
  '{"variantId":"var_...","warehouseId":"wh_...","delta":100,"reason":"initial_stock"}'
```

### Inter-warehouse transfer

A transfer is two movements: `transfer_out` from the source, `transfer_in` to the destination. Post both. Reference the other movement's ID in each `note` for traceability. Atomic transfer is on the roadmap.

### Refund restock

When you process a refund through Plugipay against an order that was already shipped, post `refund_restock` with the same quantity the shipment consumed. The Plugipay-webhook handler does this automatically for orders Fulkruma routed; you only call it manually for refunds outside that flow.

## Next

- [**Products**](/docs/api/resources/products) &mdash; create the variants that stock attaches to.
- [**Shipments**](/docs/api/resources/shipments) &mdash; consume reservations and decrement levels.
- [**Warehouses**](/docs/api/resources/warehouses) &mdash; create the locations stock sits in.
- [**Authentication**](/docs/api/authentication) &mdash; HMAC signing recipe.
