---
title: Deliveries
---

# Deliveries

A **delivery** is the digital-fulfilment counterpart to a shipment. Where a shipment hands a parcel to a courier, a delivery hands a download link (or a license) to a buyer of a `type: 'digital'` product. Each delivery has a max download count, an expiry, and an event trail. This page covers the `fulkruma.deliveries` namespace. For HTTP fields, see [API: Deliveries](/docs/api/resources/deliveries).

## Namespace

`fulkruma.deliveries` &mdash; every method:

```ts
fulkruma.deliveries.create(input)
fulkruma.deliveries.get(id)
fulkruma.deliveries.list()
```

Three methods. There's no `update` (delivery terms are immutable after issuance) and no `revoke` &mdash; the closest thing to "revoke" is letting the delivery expire, or revoking the underlying license via `licenses.revoke` if the product is license-gated.

## Methods

### `deliveries.create`

**Signature.** `fulkruma.deliveries.create(input): Promise<{ delivery: Delivery }>`

Issues a delivery. Pass the product, the customer, the checkout session it came from, and optionally a download cap and expiry. The SDK auto-mints an `Idempotency-Key` &mdash; replay-safe, which matters because creating two deliveries means two emails fly out.

```ts
const { delivery } = await fulkruma.deliveries.create({
  productId: 'prod_01HX...',
  customerId: 'cus_01HX...',
  checkoutSessionId: 'cs_01HX...',
  maxDownloads: 5,
  expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  externalSource: 'storlaunch',
  externalRef: 'order-118-dl-1',
});

console.log(delivery.id, delivery.downloadUrl);
```

`maxDownloads` defaults to whatever the product configures (or unlimited if neither sets one). `expiresAt` defaults to 30 days from issuance.

<blockquote class="callout-note">

**The `downloadUrl` is signed and short-lived.** It carries an embedded HMAC and expires after a few minutes. Email it to the buyer directly; don't cache it in your own system. Re-fetching via `deliveries.get` returns a freshly-signed URL each time.

</blockquote>

### `deliveries.get`

**Signature.** `fulkruma.deliveries.get(id): Promise<{ delivery: Delivery }>`

Fetches one delivery by `del_*` ID. Returns a fresh signed `downloadUrl` and the latest download-count metrics.

```ts
const { delivery } = await fulkruma.deliveries.get('del_01HX...');
console.log(`${delivery.downloadCount}/${delivery.maxDownloads ?? '∞'} downloads used`);
```

### `deliveries.list`

**Signature.** `fulkruma.deliveries.list(): Promise<{ deliveries: Delivery[] }>`

Returns every delivery in the workspace, freshest first. Not paginated &mdash; we expect modest volumes per workspace.

```ts
const { deliveries } = await fulkruma.deliveries.list();
const expired = deliveries.filter(
  (d) => d.expiresAt && new Date(d.expiresAt) < new Date(),
);
```

## Types

```ts
interface Delivery {
  id: string;              // 'del_...'
  accountId: string;
  productId: string;
  customerId: string;
  checkoutSessionId: string;
  status: 'pending' | 'ready' | 'delivered' | 'expired';
  downloadUrl: string | null;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: string | null;
  externalSource: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
}
```

For the full field reference, see [API: Deliveries](/docs/api/resources/deliveries).

## Common patterns

### Issue on checkout-completed webhook

The canonical flow: listen for `plugipay.checkout.completed`, look up the product, decide if it's digital, fire a delivery:

```ts
async function onCheckoutCompleted(session: { id: string; customerId: string; productId: string }) {
  const { product } = await fulkruma.products.get(session.productId);
  if (product.type !== 'digital') return;

  const { delivery } = await fulkruma.deliveries.create({
    productId: product.id,
    customerId: session.customerId,
    checkoutSessionId: session.id,
  });

  await sendDownloadEmail(session.customerId, delivery.downloadUrl!);
}
```

If the product is `licenseEnabled`, issue a license too (see [`licenses.issue`](/docs/sdk/node/resources/licenses)) and email both.

### Re-send a download link

Buyer lost the email; want to resend:

```ts
const { delivery } = await fulkruma.deliveries.get('del_01HX...');
if (delivery.expiresAt && new Date(delivery.expiresAt) > new Date()) {
  await sendDownloadEmail(delivery.customerId, delivery.downloadUrl!);
} else {
  // Expired — issue a new delivery off the same checkout session
  const { delivery: fresh } = await fulkruma.deliveries.create({
    productId: delivery.productId,
    customerId: delivery.customerId,
    checkoutSessionId: delivery.checkoutSessionId,
  });
  await sendDownloadEmail(fresh.customerId, fresh.downloadUrl!);
}
```

### Audit expired deliveries

For periodic cleanup or reporting:

```ts
async function expiredDeliveriesReport() {
  const { deliveries } = await fulkruma.deliveries.list();
  return deliveries.filter((d) => d.status === 'expired');
}
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Missing required IDs, bad `expiresAt` format. |
| `not_found` | 404 | Product, customer, or checkout-session ID missing. |
| `conflict` | 409 | Product is not `type: 'digital'`. |
| `forbidden` | 403 | Key lacks `fulkruma:delivery:write` scope. |

See [Errors](/docs/sdk/node/errors) for the full hierarchy.

## Next

- [Licenses](/docs/sdk/node/resources/licenses) &mdash; the activation-counted credential layer for digital products.
- [Products](/docs/sdk/node/resources/products) &mdash; how to flag a product as digital.
- [API: Deliveries](/docs/api/resources/deliveries) &mdash; HTTP reference.
