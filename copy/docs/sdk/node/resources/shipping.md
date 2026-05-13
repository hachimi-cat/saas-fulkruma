---
title: Shipping
---

# Shipping

The `shipping` namespace is everything you need **before** booking a shipment: list available couriers, configure the workspace's default origin, and quote rates. It's intentionally separate from `shipments` &mdash; the latter mutates state, this one is mostly read-only metadata. For HTTP fields, see [API: Shipping](/docs/api/resources/shipping).

## Namespace

`fulkruma.shipping` &mdash; every method:

```ts
fulkruma.shipping.couriers()
fulkruma.shipping.origin()
fulkruma.shipping.setOrigin(input)
fulkruma.shipping.rates(input)
```

Four methods. Three reads, one config mutation (`setOrigin`).

## Methods

### `shipping.couriers`

**Signature.** `fulkruma.shipping.couriers(): Promise<unknown[]>`

Returns the list of couriers available in the workspace, with their service codes (e.g. JNE `reg`, JNE `yes`, J&T `ez`). The shape is intentionally loose &mdash; it passes through whatever Biteship (or the future direct integrations) returns &mdash; so wrap it in your own typed adapter if you depend on specific fields.

```ts
const couriers = await fulkruma.shipping.couriers();
for (const c of couriers as Array<{ courierCode: string; courierName: string; services: any[] }>) {
  console.log(c.courierCode, c.courierName, c.services.length, 'services');
}
```

The list is keyed off the merchant's enabled couriers in the portal &mdash; if a courier isn't there, enable it in the dashboard first.

### `shipping.origin` and `shipping.setOrigin`

**Signature.**
- `fulkruma.shipping.origin(): Promise<unknown>`
- `fulkruma.shipping.setOrigin(input): Promise<unknown>`

The workspace's default origin &mdash; pickup location, sender contact, area code &mdash; used when a shipment doesn't explicitly include an `origin`. Read it via `origin()`, write it via `setOrigin()`.

```ts
const current = await fulkruma.shipping.origin();

await fulkruma.shipping.setOrigin({
  contactName: 'Warehouse Manager',
  contactPhone: '+62211234567',
  address: 'Jl. Sudirman No. 1',
  postalCode: '12190',
  areaId: 'IDN-JKT-CTL',
  lat: -6.2088,
  lng: 106.8456,
});
```

The default origin is what `shipments.create({ origin: { warehouseId } })` resolves against when a warehouse doesn't have its own address on file. If every warehouse you have is fully populated, you can ignore the workspace-level origin.

### `shipping.rates`

**Signature.** `fulkruma.shipping.rates(input): Promise<unknown>`

The most-used method on this namespace. Posts a destination + line items + (optional) insurance flag, returns a list of `{ courierCode, courierServiceCode, courierType, price, etd, ... }` &mdash; one per (courier, service) combination. Quotes are live (round-tripped through Biteship) and valid for a short window.

```ts
const quote = await fulkruma.shipping.rates({
  destination: {
    areaId: 'IDN-JKT-MTH',
    postalCode: '10310',
  },
  items: [
    { variantId: 'var_01HX...', quantity: 2, weight: 0.5 },
  ],
  insurance: true,
});

// shape: { rates: [{ courierCode, courierServiceCode, price, etd, ... }, ...] }
for (const r of (quote as { rates: any[] }).rates) {
  console.log(`${r.courierCode}/${r.courierServiceCode}: Rp${r.price} (ETD ${r.etd})`);
}
```

The same `courierCode`/`courierServiceCode`/`price` triple is what you pass to [`shipments.create`](/docs/sdk/node/resources/shipments) once the customer picks one.

## Types

The shipping namespace returns intentionally-untyped values (`unknown`) because the upstream courier API (Biteship today) controls the shape. For stability, the only fields we promise across courier providers are:

- `rates[].courierCode` &mdash; matches what `shipments.create` expects
- `rates[].courierServiceCode`
- `rates[].courierType`
- `rates[].price` (integer rupiah)
- `rates[].etd` (estimated delivery, vendor-specific format)

Everything else is passthrough. See [API: Shipping](/docs/api/resources/shipping) for the full per-provider field map.

## Common patterns

### Quote, render, book

The canonical pattern &mdash; user picks from a list of quotes, then you book:

```ts
async function checkoutShipping(customerAddress: { areaId: string; postalCode: string }, lineItems: Array<{ variantId: string; quantity: number; weight: number }>) {
  const quote = await fulkruma.shipping.rates({
    destination: customerAddress,
    items: lineItems,
  });
  const rates = (quote as { rates: any[] }).rates;
  // … render rates as radio buttons in your UI, let user pick …
  return rates;
}
```

The book half lives in [`shipments.create`](/docs/sdk/node/resources/shipments).

### Cache courier list per session

`shipping.couriers()` is workspace-scoped config that rarely changes &mdash; safe to memoize for the lifetime of your server process:

```ts
let couriersCache: unknown[] | null = null;
async function getCouriers() {
  if (!couriersCache) {
    couriersCache = await fulkruma.shipping.couriers();
  }
  return couriersCache;
}
```

Invalidate on a `fulkruma.integration.biteship.updated` webhook if you need to be fully reactive; in practice, restart-on-deploy is fine.

### Initial setup: configure origin once

For a fresh workspace, you'll typically call `setOrigin` exactly once at onboarding time:

```ts
await fulkruma.shipping.setOrigin({
  contactName: 'Fulfillment',
  contactPhone: '+62211234567',
  address: 'Jl. Sudirman No. 1, Jakarta',
  postalCode: '12190',
  areaId: 'IDN-JKT-CTL',
});
```

After that, individual shipments inherit it via `origin: { warehouseId }` resolution.

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Bad `areaId`, missing `weight` on items. |
| `not_found` | 404 | Variant in `items[]` doesn't exist. |
| `courier_error` | 502 | Upstream courier (Biteship) rejected the rate request. |
| `forbidden` | 403 | Key lacks `fulkruma:shipping:read` / `:write`. |

`courier_error` is the retry candidate &mdash; transient blips at the courier aggregator are the most common failure mode here.

## Next

- [Shipments](/docs/sdk/node/resources/shipments) &mdash; the other side of the quote-then-book flow.
- [Addresses](/docs/sdk/node/resources/addresses) &mdash; destinations to quote against.
- [API: Shipping](/docs/api/resources/shipping) &mdash; HTTP reference.
