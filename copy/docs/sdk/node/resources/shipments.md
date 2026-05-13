---
title: Shipments
---

# Shipments

A **shipment** is the record of a parcel handed off to a courier. It carries the courier code + service code, the price the merchant was quoted, an origin + destination, and the items packed into it. Fulkruma wires this to Biteship (its first courier aggregator) and emits `fulkruma.shipment.*` webhooks as the carrier sends status updates. This page covers the `fulkruma.shipments` namespace. For HTTP fields, see [API: Shipments](/docs/api/resources/shipments).

## Namespace

`fulkruma.shipments` &mdash; every method:

```ts
fulkruma.shipments.create(input)
fulkruma.shipments.get(id)
fulkruma.shipments.list(params?)
```

There's no `update` and no `cancel` &mdash; once a label is booked with a courier, mutation goes through the courier's portal (or a support ticket). The closest thing to "cancel" is the carrier's own cancellation event, which Fulkruma surfaces as a `shipment.updated` webhook.

## Methods

### `shipments.create`

**Signature.** `fulkruma.shipments.create(input): Promise<{ shipment: Shipment }>`

Books a shipment with the chosen courier. The SDK auto-mints an `Idempotency-Key` &mdash; replay-safe, which matters for shipments because creating one twice means paying the courier twice.

```ts
const { shipment } = await fulkruma.shipments.create({
  customerId: 'cus_01HX...',
  courierCode: 'jne',
  courierServiceCode: 'reg',
  courierType: 'standard',
  price: 18_000,
  origin: {
    warehouseId: 'wh_01HX...',  // resolved server-side to address+coords
  },
  destination: {
    contactName: 'Alice Tan',
    contactPhone: '+62812xxxxxxxx',
    address: 'Jl. Diponegoro No. 5',
    postalCode: '10310',
    areaId: 'IDN-JKT-MTH',
  },
  items: [
    { variantId: 'var_01HX...', quantity: 2, weight: 0.3 },
  ],
});

console.log(shipment.id, shipment.trackingNumber);
```

`origin` and `destination` are intentionally loosely typed &mdash; the backend validates the shape per courier (Biteship expects a different envelope than a future JNE direct integration). For warehouse-origin shipments, pass `{ warehouseId }` and let the server resolve the address.

<blockquote class="callout-note">

**The `price` you pass is what you charge the customer.** It must match (or exceed) the quote from `shipping.rates` for the same `courierCode`/`courierServiceCode`/`destination`. Fulkruma validates this server-side; if you pass below-quote, you'll get `400 validation_error`.

</blockquote>

### `shipments.get`

**Signature.** `fulkruma.shipments.get(id): Promise<{ shipment: Shipment }>`

Fetches one shipment by `ship_*` ID. Includes the latest tracking events embedded in the response.

```ts
const { shipment } = await fulkruma.shipments.get('ship_01HX...');
console.log(shipment.status);                  // 'in_transit'
console.log(shipment.events.length);           // count of tracking events
```

### `shipments.list`

**Signature.** `fulkruma.shipments.list(params?): Promise<{ shipments: Shipment[] }>`

Lists shipments in the workspace. Pass `status` to filter (e.g. `pending`, `confirmed`, `picked_up`, `in_transit`, `delivered`, `returned`, `cancelled`).

```ts
const { shipments } = await fulkruma.shipments.list({ status: 'in_transit' });
console.log(`${shipments.length} parcels currently moving`);
```

Status filter is exact-match. There's no date filter at the SDK layer &mdash; use the `webhooks.listEvents` ledger if you need a time-bounded scan.

## Types

```ts
interface Shipment {
  id: string;              // 'ship_...'
  accountId: string;
  customerId: string | null;
  customerEmail: string | null;
  courierCode: string;
  courierServiceCode: string;
  courierType: string;
  status: ShipmentStatus;
  trackingNumber: string | null;
  price: number;
  insurance: number | null;
  insured: boolean;
  origin: Record<string, unknown>;
  destination: Record<string, unknown>;
  items: Array<{ variantId: string; quantity: number; weight: number; productId?: string }>;
  events: ShipmentEvent[];
  externalSource: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
}

type ShipmentStatus =
  | 'pending' | 'confirmed' | 'picked_up' | 'in_transit'
  | 'delivered' | 'returned' | 'cancelled';

interface ShipmentEvent {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  description: string;
  occurredAt: string;
}
```

For the full courier-code vocabulary and per-courier `origin`/`destination` schemas, see [API: Shipments](/docs/api/resources/shipments).

## Common patterns

### Quote-then-book

The robust pattern: quote first via [`shipping.rates`](/docs/sdk/node/resources/shipping), let the customer pick, then book:

```ts
const rates = await fulkruma.shipping.rates({
  destination: { areaId: 'IDN-JKT-MTH', postalCode: '10310' },
  items: [{ variantId: 'var_01HX...', quantity: 1, weight: 0.5 }],
});

// User picks a rate in your UI
const picked = (rates as { rates: any[] }).rates[0];

const { shipment } = await fulkruma.shipments.create({
  customerId: 'cus_01HX...',
  courierCode: picked.courierCode,
  courierServiceCode: picked.courierServiceCode,
  courierType: picked.courierType,
  price: picked.price,
  origin: { warehouseId: 'wh_01HX...' },
  destination: { areaId: 'IDN-JKT-MTH', postalCode: '10310', contactName: 'Alice', contactPhone: '+62812xxxxxxxx', address: 'Jl. Diponegoro 5' },
  items: [{ variantId: 'var_01HX...', quantity: 1, weight: 0.5 }],
});
```

### Track via webhook

Don't poll `shipments.get` in a loop &mdash; subscribe to `fulkruma.shipment.updated`:

```ts
fulkruma.webhooks.createEndpoint({
  url: 'https://your-app.example.com/webhooks/fulkruma',
  events: ['fulkruma.shipment.updated', 'fulkruma.shipment.delivered'],
});
```

Then verify + handle in your endpoint. See [`webhooks`](/docs/sdk/node/resources/webhooks) and [`shipment.updated`](/docs/api/webhooks/events/fulkruma.shipment.created).

### Idempotent re-booking after partial failure

If the courier API timed out and you don't know whether the shipment was created, retry with the same `externalRef`:

```ts
await fulkruma.shipments.create({
  /* ... */
  externalRef: 'order-2026-118',
  externalSource: 'storlaunch',
});
```

The auto-generated `Idempotency-Key` covers in-process retries; for cross-process replay use a stable `externalRef` and check `shipments.list({})` first.

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Missing courier fields, price below quote, bad destination shape. |
| `not_found` | 404 | Customer, warehouse, or variant ID missing. |
| `conflict` | 409 | Insufficient stock at the origin warehouse. |
| `courier_error` | 502 | Upstream courier (Biteship) rejected the booking. |
| `forbidden` | 403 | Key lacks `fulkruma:shipment:write` scope. |

`courier_error` is the one to retry &mdash; with backoff &mdash; because it usually means a transient upstream blip.

## Next

- [Shipping](/docs/sdk/node/resources/shipping) &mdash; rate quotes + courier listing + origin config.
- [Stock](/docs/sdk/node/resources/stock) &mdash; the inventory shipments draw from.
- [Webhooks](/docs/sdk/node/resources/webhooks) &mdash; how to receive status events.
- [API: Shipments](/docs/api/resources/shipments) &mdash; HTTP reference.
