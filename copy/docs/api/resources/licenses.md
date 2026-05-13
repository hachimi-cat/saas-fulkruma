---
title: Licenses
---

# Licenses

A **license** is a key that unlocks software you sell. Fulkruma issues one license per fulfilment of a `license`-type [product](/docs/api/resources/products) at checkout, tracks how many devices ("instances") have activated it, and exposes three **public** endpoints &mdash; `activate`, `deactivate`, `validate` &mdash; that the buyer's software calls directly with only the key.

Keys are formatted as 5 groups of 5 base32 characters, e.g. `7K3PH-9X2RM-4LBQE-PT86W-JF1RV`. They're stable, never reissued, and revoking them transitions the key to `revoked` &mdash; the public endpoints then refuse further activation.

The merchant-facing endpoints (`/licenses` POST/GET, `/licenses/:id/revoke`) require signed requests; the public endpoints are unauthenticated. See [**Authentication**](/docs/api/authentication) for the signing recipe.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/licenses` | HMAC | List licenses |
| `POST` | `/api/v1/licenses` | HMAC | Issue a license |
| `POST` | `/api/v1/licenses/:id/revoke` | HMAC | Revoke a license |
| `GET` | `/api/v1/licenses/validate` | public | Check whether a key is still valid |
| `POST` | `/api/v1/licenses/activate` | public | Bind a key to an instance |
| `POST` | `/api/v1/licenses/deactivate` | public | Release an instance |

### List licenses

```
GET /api/v1/licenses
```

Returns up to 100 licenses in the workspace, newest first.

**Response shape**

```json
{
  "data": {
    "licenses": [
      {
        "id": "lic_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "accountId": "acc_01HX...",
        "productId": "prod_01HX...",
        "customerId": "cus_01HX...",
        "key": "7K3PH-9X2RM-4LBQE-PT86W-JF1RV",
        "status": "active",
        "activations": 1,
        "maxActivations": 3,
        "expiresAt": null,
        "externalSource": "storlaunch",
        "externalRef": "ord_19238",
        "createdAt": "2026-05-12T10:42:00.123Z"
      }
    ]
  },
  ...
}
```

### Issue a license

```
POST /api/v1/licenses
```

Issues a new license for a product + customer pair and emits a [`fulkruma.license.issued.v1`](/docs/api/webhooks/events/fulkruma.license.issued) event. The Plugipay webhook handler calls this automatically when a checkout for a `license`-type product completes; you can also call it manually for off-platform sales or upgrades.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `productId` | string (`prod_…`) | yes | Must reference a `license`-type product in the workspace. |
| `customerId` | string | yes | The buyer's ID. Free-form (Fulkruma doesn't enforce a particular format; some merchants store Plugipay customer IDs here, others their own). |
| `maxActivations` | integer (&ge;1) | no | Default `1`. The number of distinct instance IDs that can activate this key concurrently. |
| `expiresAt` | string (ISO 8601) | no | Hard expiry. After this, `validate` returns `valid: false` with `status: "expired"`. |
| `externalSource` | string (&le;50) | no | Where the issue originated (`storlaunch`, your storefront name). |
| `externalRef` | string (&le;255) | no | The originating system's order/sale ID. |

**Response** &mdash; `201 Created`. The full [license object](#the-license-object) with the generated `key` field. The plaintext key is also stored on Fulkruma's row &mdash; you can re-fetch via list/retrieve.

<blockquote class="callout-tip">

**Email the key to the buyer in the same request.** Fulkruma doesn't send the email itself in v1 &mdash; you wire that up on your side. Subscribe to `fulkruma.license.issued.v1` if your issuance pipeline is async.

</blockquote>

### Revoke a license

```
POST /api/v1/licenses/:id/revoke
```

Marks the license `revoked` and emits a [`fulkruma.license.revoked.v1`](/docs/api/webhooks/events/fulkruma.license.revoked) event. The public `activate` endpoint then returns `404 INVALID_KEY` on further attempts; `validate` returns `valid: false`. Existing active instances are not forcibly cut off &mdash; they keep working until the next time they call `validate`. There is no unrevoke; mint a new license.

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `404` | `NOT_FOUND` | License doesn't exist in this workspace. |

```bash
fulkruma_curl POST '/api/v1/licenses/lic_01HX.../revoke' ''
```

### Validate a license (public)

```
GET /api/v1/licenses/validate?key=<key>&productId=<optional>
```

Public &mdash; no HMAC required. Use this in the buyer's software to check whether a key is still good. Designed to never error on bad input: an unknown or revoked key returns a normal `200` response with `valid: false`.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `key` | string | The license key. |
| `productId` | string | Optional. If provided, the key must also belong to this product. |

**Response shape**

```json
{
  "data": {
    "valid": true,
    "key": "7K3PH-9X2RM-4LBQE-PT86W-JF1RV",
    "status": "active",
    "productId": "prod_01HX...",
    "activations": 1,
    "maxActivations": 3,
    "expiresAt": null
  },
  "error": null,
  "meta": { ... }
}
```

For unknown keys, `valid` is `false` and the rest of the payload is `null`. For revoked keys, `valid` is `false` with `status: "revoked"`. For expired keys, `valid: false`, `status: "expired"`.

### Activate a license (public)

```
POST /api/v1/licenses/activate
```

Binds a license to an instance ID. The first call for a fresh `(key, instanceId)` pair creates a `LicenseActivation` row and increments the license's `activations` counter; subsequent calls for the same pair return `alreadyActive: true` without side-effects. The maximum number of distinct concurrent instances is capped at the license's `maxActivations` &mdash; the `(maxActivations + 1)`th distinct instance returns `MAX_ACTIVATIONS`.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | The license key. |
| `instanceId` | string | yes | An identifier for the activating device. Suggestion: hash of `(machine ID + product version)` so reinstalls reuse the slot. |

**Response shape**

```json
{
  "data": {
    "license": {
      "id": "lic_01HX...",
      "productId": "prod_01HX...",
      "customerId": "cus_01HX...",
      "key": "7K3PH-9X2RM-4LBQE-PT86W-JF1RV",
      "status": "active",
      "activations": 1,
      "maxActivations": 3,
      "expiresAt": null
    },
    "activation": {
      "id": "act_01HX...",
      "licenseId": "lic_01HX...",
      "instanceId": "machine_a1b2c3",
      "activatedAt": "2026-05-12T10:42:00.123Z",
      "deactivatedAt": null
    },
    "alreadyActive": false
  },
  "error": null,
  "meta": { ... }
}
```

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Missing `key` or `instanceId`, or `key` shorter than 8 chars. |
| `404` | `INVALID_KEY` | Key doesn't exist or has been revoked. |
| `403` | `EXPIRED` | Key has expired. |
| `409` | `MAX_ACTIVATIONS` | License is already at its `maxActivations` cap with this `instanceId` not among them. |

### Deactivate a license (public)

```
POST /api/v1/licenses/deactivate
```

Releases an `instanceId`'s slot so it can be activated elsewhere. Idempotent: deactivating an already-deactivated (or never-activated) pair returns `200` with `alreadyDeactivated: true`.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | The license key. |
| `instanceId` | string | yes | The instance ID to release. |

**Response shape**

```json
{
  "data": {
    "deactivated": true,
    "alreadyDeactivated": false,
    "activations": 2
  },
  "error": null,
  "meta": { ... }
}
```

## The license object

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | no | Fulkruma ID. Always `lic_` + 26-char ULID. |
| `accountId` | string | no | The workspace. |
| `productId` | string | no | The licensed product. Must be `type: license`. |
| `customerId` | string | no | The buyer's ID. |
| `key` | string | no | The plaintext key (`XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`). Returned in the list/retrieve response. |
| `status` | enum | no | `active` or `revoked`. |
| `activations` | integer | no | Currently active instance count. |
| `maxActivations` | integer | no | Maximum concurrent instances. |
| `expiresAt` | string \| null | yes | Hard expiry, or `null` for perpetual keys. |
| `externalSource` | string | yes | Where the issue originated. |
| `externalRef` | string | yes | Origin system's order ID. |
| `createdAt` | string (ISO 8601 UTC) | no | Issuance timestamp. |

### The activation object

| Field | Type | Description |
|---|---|---|
| `id` | string (`act_…`) | Activation row ID. |
| `licenseId` | string | The license this binds. |
| `instanceId` | string | Buyer-supplied instance identifier. |
| `activatedAt` | string (ISO 8601 UTC) | Initial activation timestamp. |
| `deactivatedAt` | string \| null | When the instance was released, or `null` if active. |

## Events

| Event type | Fires on | Notes |
|---|---|---|
| `fulkruma.license.issued.v1` | `POST /api/v1/licenses` succeeds. Includes auto-issue from the Plugipay-checkout webhook. | Emitted in the same transaction as the license insert. |
| `fulkruma.license.revoked.v1` | `POST /api/v1/licenses/:id/revoke` succeeds. | Emitted in the same transaction as the status flip. |

`license.activated` and `license.deactivated` are reserved in the catalog but **not currently emitted** &mdash; the activate/deactivate endpoints fire frequently and webhook-noise tradeoffs aren't yet resolved. Poll `validate` on the buyer's side, or subscribe to issued/revoked and audit on your end.

See [**Webhooks**](/docs/api/resources/webhooks) for the envelope and signature recipe.

## Patterns

### Software offline-tolerance

The public `validate` endpoint takes &lt;200ms and rarely fails, but networks do go down. Cache the last successful `validate` response for up to 72 hours; on cache miss + failed network, allow the software to run for a configurable grace period. Re-validate on app launch and on a daily cron.

### Reinstall on the same device

Pick an `instanceId` that's stable across reinstalls (hashed machine ID, hardware fingerprint). A fresh install on the same device hits `activate` with the same `instanceId` and gets back `alreadyActive: true` &mdash; no slot consumed.

### Transferring to a new device

Call `/deactivate` with the old `instanceId`, then `/activate` with the new one. The slot moves cleanly. If the old device is dead and you can't deactivate from it, instruct the buyer to revoke + reissue from your dashboard.

## Next

- [**Products**](/docs/api/resources/products) &mdash; create `license`-type products first.
- [**Deliveries**](/docs/api/resources/deliveries) &mdash; the equivalent for digital downloads.
- [**Authentication**](/docs/api/authentication) &mdash; HMAC signing for merchant-facing endpoints.
