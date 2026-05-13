---
title: Deliveries
---

# Deliveries

A **delivery** is a time-limited, download-count-limited grant for a `digital`-type [product](/docs/api/resources/products). Fulkruma issues one delivery per checkout of a digital product, tracks how many times the buyer has downloaded against it, and (in the next iteration) signs download URLs that respect the grant.

A delivery has three guardrails:

- `maxDownloads` &mdash; how many times the buyer can fetch the file (default `5`).
- `expiresAt` &mdash; a hard cutoff after which the grant is no longer valid (default 14 days from create).
- `consumedAt` and `downloads` &mdash; the runtime counters Fulkruma updates as the buyer fetches.

There's at most one delivery per `(checkoutSessionId, productId)` pair &mdash; the second create attempt returns `409 DUPLICATE`. This protects against double-fulfilment on webhook retry.

All requests on this page must be signed &mdash; see [**Authentication**](/docs/api/authentication).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/deliveries` | List deliveries |
| `GET` | `/api/v1/deliveries/:id` | Retrieve a single delivery |
| `POST` | `/api/v1/deliveries` | Issue a delivery grant |

There is no PATCH/DELETE in v1: deliveries are immutable once issued. To revoke, set `expiresAt` to a past time via a backfill (planned).

### List deliveries

```
GET /api/v1/deliveries
```

Returns up to 100 deliveries in the workspace, newest first.

```json
{
  "data": {
    "deliveries": [
      {
        "id": "del_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "accountId": "acc_01HX...",
        "productId": "prod_01HX...",
        "customerId": "cus_01HX...",
        "checkoutSessionId": "cs_01HX...",
        "maxDownloads": 5,
        "downloads": 1,
        "expiresAt": "2026-05-26T10:42:00.123Z",
        "externalSource": "storlaunch",
        "externalRef": "ord_19238",
        "createdAt": "2026-05-12T10:42:00.123Z"
      }
    ]
  },
  ...
}
```

### Retrieve a delivery

```
GET /api/v1/deliveries/:id
```

Returns the delivery by ID.

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `404` | `NOT_FOUND` | Delivery doesn't exist in this workspace. |

### Issue a delivery

```
POST /api/v1/deliveries
```

Issues a delivery for a product + customer + checkout combination and emits a [`fulkruma.delivery.created.v1`](/docs/api/webhooks/events/fulkruma.delivery.created) event. The Plugipay webhook handler calls this automatically when a checkout for a `digital`-type product completes; manual calls are for off-platform sales or replacement grants.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `productId` | string (`prod_…`) | yes | Must reference a `digital`-type product in the workspace. |
| `customerId` | string | yes | The buyer's ID. Free-form. |
| `checkoutSessionId` | string | yes | The Plugipay checkout session that originated this order. Unique-per-product within the workspace &mdash; second create attempt returns `409 DUPLICATE`. |
| `maxDownloads` | integer (1&ndash;100) | no | Default `5`. |
| `expiresAt` | string (ISO 8601) | no | Default 14 days from creation. |
| `externalSource` | string (&le;50) | no | Where the issue originated. |
| `externalRef` | string (&le;255) | no | Origin system's order/sale ID. |

**Response** &mdash; `201 Created`. The full [delivery object](#the-delivery-object).

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Missing required field. |
| `403` | `NO_ACCOUNT` | Token has no `accountId`. |
| `409` | `DUPLICATE` | A delivery for that `(productId, checkoutSessionId)` already exists. The webhook handler depends on this for idempotent retry safety. |

```bash
fulkruma_curl POST '/api/v1/deliveries' \
  '{"productId":"prod_...","customerId":"cus_...","checkoutSessionId":"cs_...","maxDownloads":5}'
```

## The delivery object

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | no | Fulkruma ID. Always `del_` + 26-char ULID. |
| `accountId` | string | no | The workspace. |
| `productId` | string | no | The digital product being delivered. |
| `customerId` | string | no | The buyer's ID. |
| `checkoutSessionId` | string | no | The Plugipay checkout that originated this. |
| `maxDownloads` | integer | no | Hard cap on fetch count. |
| `downloads` | integer | no | Current download count. Increments on each fulfilled fetch (planned). |
| `expiresAt` | string (ISO 8601 UTC) | no | Hard cutoff. |
| `externalSource` | string | yes | Origin system name. |
| `externalRef` | string | yes | Origin system's order ID. |
| `createdAt` | string (ISO 8601 UTC) | no | Creation timestamp. |

## Events

| Event type | Fires on | Notes |
|---|---|---|
| `fulkruma.delivery.created.v1` | `POST /api/v1/deliveries` succeeds. Includes auto-issue from the Plugipay-checkout webhook. | Emitted in the same transaction as the delivery insert. |

`delivery.downloaded` and `delivery.expired` are reserved in the catalog but **not currently emitted.**

See [**Webhooks**](/docs/api/resources/webhooks) for the envelope and signature recipe.

## Pattern: signed download URLs (planned)

In Phase F, deliveries will expose a `/api/v1/deliveries/:id/download` endpoint that returns a short-lived signed URL pointing at the actual asset (hosted in your own object store; Fulkruma signs, doesn't host). The endpoint will check `expiresAt`, increment `downloads`, and reject once `downloads >= maxDownloads`.

Until then, you serve the asset yourself, looking up `(productId, customerId)` in your own database and applying the same guardrails.

## Next

- [**Products**](/docs/api/resources/products) &mdash; create `digital`-type products first.
- [**Licenses**](/docs/api/resources/licenses) &mdash; the equivalent for license-key fulfilment.
- [**Authentication**](/docs/api/authentication).
