---
title: Licenses
---

# Licenses

A **license** is an activation-counted credential for a `licenseEnabled` product. Issue one per purchase; the buyer's software calls `activate` to bind a device and `validate` on each launch. Licenses pair with deliveries: the delivery hands over the bits, the license gates how many devices can run them. This page covers the `fulkruma.licenses` namespace. For HTTP fields, see [API: Licenses](/docs/api/resources/licenses).

## Namespace

`fulkruma.licenses` &mdash; every method:

```ts
fulkruma.licenses.list()
fulkruma.licenses.issue(input)
fulkruma.licenses.revoke(id)
fulkruma.licenses.activate(input)     // public, unauthenticated
fulkruma.licenses.deactivate(input)   // public, unauthenticated
fulkruma.licenses.validate(params)    // public, unauthenticated
```

The first three need the workspace HMAC key. The last three are **public** &mdash; called by the licensed software on the buyer's machine, which doesn't have your secret. The SDK still attaches the HMAC header when configured to (it doesn't hurt), but the backend treats these routes as unauthenticated.

## Methods

### `licenses.issue`

**Signature.** `fulkruma.licenses.issue(input): Promise<{ license: License }>`

Issues a license for a product + customer pair. Pass `maxActivations` to cap how many devices can use the key (defaults to the product's `maxActivations`, or unlimited if neither sets one). Pass `expiresAt` for a time-limited license. The SDK auto-mints an `Idempotency-Key`.

```ts
const { license } = await fulkruma.licenses.issue({
  productId: 'prod_01HX...',
  customerId: 'cus_01HX...',
  maxActivations: 3,
  expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
  externalSource: 'storlaunch',
  externalRef: 'order-118-license',
});

console.log(license.key);    // → 'FULK-XXXX-XXXX-XXXX-XXXX' — email this to the buyer
```

The `key` is generated server-side using a high-entropy alphabet and is the only thing the buyer's software ever sees &mdash; everything else (status, expiry, activation count) is queried via `validate`.

### `licenses.list`

**Signature.** `fulkruma.licenses.list(): Promise<{ licenses: License[] }>`

Returns every license in the workspace. Not paginated.

```ts
const { licenses } = await fulkruma.licenses.list();
const active = licenses.filter((l) => l.status === 'active');
```

### `licenses.revoke`

**Signature.** `fulkruma.licenses.revoke(id): Promise<{ license: License }>`

Marks a license as revoked. Subsequent `validate` calls return `valid: false, status: 'revoked'`. There's no "un-revoke" &mdash; issue a fresh license if you need to restore access.

```ts
await fulkruma.licenses.revoke('lic_01HX...');
```

Revoke is the right tool for chargebacks, fraud, and refunds &mdash; the buyer's software starts failing license checks on next launch.

### `licenses.activate` (public)

**Signature.** `fulkruma.licenses.activate(input): Promise<{ license: License; activation: LicenseActivation; alreadyActive: boolean }>`

Called by the buyer's software on first launch to bind a device. Pass the license `key` and a stable `instanceId` (your software generates this once, persists it on disk, sends the same value every time). Returns `alreadyActive: true` if the (key, instanceId) pair is already registered &mdash; treat that as success, not error.

```ts
const result = await fulkruma.licenses.activate({
  key: 'FULK-XXXX-XXXX-XXXX-XXXX',
  instanceId: '550e8400-e29b-41d4-a716-446655440000',  // your software's persisted UUID
});

if (result.activation) {
  // Success — cache locally and re-validate on next launch
}
```

If the license already has `maxActivations` instances registered, the call returns `409 max_activations_exceeded`.

### `licenses.deactivate` (public)

**Signature.** `fulkruma.licenses.deactivate(input): Promise<{ deactivated: boolean; alreadyDeactivated: boolean; activations: number }>`

Releases an instance &mdash; the user is uninstalling, or moving to a new device. Frees up an activation slot.

```ts
await fulkruma.licenses.deactivate({
  key: 'FULK-XXXX-XXXX-XXXX-XXXX',
  instanceId: '550e8400-e29b-41d4-a716-446655440000',
});
```

### `licenses.validate` (public)

**Signature.** `fulkruma.licenses.validate(params): Promise<{ valid: boolean; key: string; status: string | null; productId: string | null; activations: number | null; maxActivations: number | null; expiresAt: string | null }>`

Called by licensed software on every launch (or periodically). Returns the current license state without binding a new activation. Treat as the source of truth &mdash; **don't trust local caches for more than a few hours**, because revocation needs to propagate.

```ts
const status = await fulkruma.licenses.validate({
  key: 'FULK-XXXX-XXXX-XXXX-XXXX',
  productId: 'prod_01HX...',  // optional, lets the server confirm key matches product
});

if (!status.valid) {
  // Lock the user out: show "license invalid" UI and bail
}
```

Reasons a license can be invalid: `revoked`, `expired`, `not_found`, `product_mismatch`.

## Types

```ts
interface License {
  id: string;              // 'lic_...'
  accountId: string;
  productId: string;
  customerId: string;
  key: string;             // the value the buyer's software sends
  status: 'active' | 'revoked' | 'expired';
  activations: number;     // current count
  maxActivations: number | null;
  expiresAt: string | null;
  externalSource: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LicenseActivation {
  id: string;
  licenseId: string;
  instanceId: string;
  activatedAt: string;
  deactivatedAt: string | null;
}
```

## Common patterns

### Issue on purchase

The canonical flow &mdash; tied to a Plugipay `checkout.completed` webhook:

```ts
async function onCheckoutCompleted(session: { id: string; customerId: string; productId: string }) {
  const { product } = await fulkruma.products.get(session.productId);
  if (!product.licenseEnabled) return;

  const { license } = await fulkruma.licenses.issue({
    productId: product.id,
    customerId: session.customerId,
    externalRef: session.id,
    externalSource: 'plugipay',
  });

  await emailLicense(session.customerId, license.key);
}
```

### Software-side validate-on-launch

Pseudo-Node for the buyer's app:

```ts
import { FulkrumaClient } from '@forjio/fulkruma-node';

// Note: no secret needed for validate/activate/deactivate — but the SDK
// constructor requires SOME credentials, so use the merchant's PUBLIC keyId
// (or your distributed pseudo-key) and any string as secret.
const fulkruma = new FulkrumaClient({
  keyId: 'AKIAFULK_DIST',
  secret: 'unused-for-public-routes',
});

async function startup(savedKey: string, savedInstanceId: string) {
  const status = await fulkruma.licenses.validate({ key: savedKey });
  if (!status.valid) {
    showLicenseInvalidScreen();
    return;
  }
  // periodic re-validate every hour
  setInterval(() => fulkruma.licenses.validate({ key: savedKey }), 3_600_000);
}
```

In practice you'd ship a small wrapper that retries validate on network failure rather than locking the user out on a flaky connection.

### Deactivate-on-uninstall

```ts
await fulkruma.licenses.deactivate({ key: savedKey, instanceId: savedInstanceId });
```

This frees a slot so the user can re-activate on a new machine without hitting `max_activations_exceeded`.

### Bulk revoke for a refund batch

```ts
async function revokeForRefunds(licenseIds: string[]) {
  for (const id of licenseIds) {
    await fulkruma.licenses.revoke(id);
  }
}
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Missing required IDs, bad `expiresAt`. |
| `not_found` | 404 | License ID or `key` missing or wrong workspace. |
| `conflict` | 409 (`max_activations_exceeded`) | Activate against an already-full license. |
| `forbidden` | 403 | Key lacks `fulkruma:license:write` scope (on issue/revoke). |
| `product_not_licensed` | 400 | Issuing on a product where `licenseEnabled = false`. |

## Next

- [Deliveries](/docs/sdk/node/resources/deliveries) &mdash; the download-link half of digital fulfillment.
- [Products](/docs/sdk/node/resources/products) &mdash; how to enable license-mode on a product.
- [API: Licenses](/docs/api/resources/licenses) &mdash; HTTP reference.
