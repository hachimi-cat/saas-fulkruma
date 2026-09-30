---
title: Billing
---

# Billing

The **billing** resource is Fulkruma's own subscription surface &mdash; it tells you what plan the merchant is on, how much they've used in the current period, recent invoices, and how to launch the Plugipay-hosted checkout for a plan change. It's not about charging the merchant's buyers; it's about charging the merchant for Fulkruma itself.

Plans are billed through Plugipay (Pattern 2 partner billing). Fulkruma never holds card data; Plugipay does.

The `/billing/plans` endpoint is **public**; everything else requires a signed request. See [**Authentication**](/docs/api/authentication).

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/billing/plans` | public | List available plans |
| `GET` | `/api/v1/billing/plan` | HMAC | Read the merchant's current plan |
| `GET` | `/api/v1/billing/subscription` | HMAC | Read the merchant's Plugipay subscription view |
| `GET` | `/api/v1/billing/usage` | HMAC | Current-period usage counters |
| `GET` | `/api/v1/billing/invoices` | HMAC | List past invoices |
| `POST` | `/api/v1/billing/checkout` | HMAC | Start a Plugipay checkout to subscribe / upgrade |
| `POST` | `/api/v1/billing/cancel` | HMAC | Cancel the current subscription |

### List plans

```
GET /api/v1/billing/plans
```

Public &mdash; no auth. Returns the plan catalog as an array: `free`, `starter`, `growth`, `scale`. Used by the marketing site's pricing section and the dashboard's plan picker.

```json
{
  "data": [
    {
      "id": "starter",
      "name": "Starter",
      "price": 299000,
      "currency": "IDR",
      "features": ["500 orders/month", "3 warehouses", "Reservations + low-stock alerts", "100 license keys"]
    }
  ],
  "error": null,
  "meta": { ... }
}
```

`price` is per month, in IDR; `features` are display strings. The limits themselves are on [`GET /billing/plan`](#read-current-plan).

### Read current plan

```
GET /api/v1/billing/plan
```

Returns the merchant's plan and its limits: `plan`, `planName`, `isForjioInternal`, `ordersLimit`, `warehousesLimit`, `licenseKeysLimit`, `apiKeysLimit`, `webhookEndpointsLimit`, `rateLimit`, `biteshipShipmentsLimit` (each `-1` for unlimited), and `billingCycleEnd`.

### Read subscription

```
GET /api/v1/billing/subscription
```

Returns `plan`, `planName`, `isForjioInternal`, `status` (lowercase: `active`, `canceling`, …), `currentPeriodStart`, `currentPeriodEnd` and `cancelAt`.

### Current-period usage

```
GET /api/v1/billing/usage
```

Returns this calendar month's counters: `plan`, `ordersFulfilled`, `ordersLimit`, `shipmentsCreated`, `licensesIssued`, and `resetAt` (the first day of next month). Powers the dashboard's "X of Y used" widgets.

### List invoices

```
GET /api/v1/billing/invoices
```

Cursor-paginated, newest first; up to `limit=50` per page (default 20). Lists the merchant's past Fulkruma invoices, mirrored from Plugipay's invoice resource.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `limit` | integer | Page size. Capped at `50`. |
| `cursor` | string | The previous page's `data.cursor`. |

**Response**

```json
{
  "data": {
    "data": [
      { "id": "inv_...", "plan": "growth", "amount": 799000, "currency": "IDR", "status": "paid", "paidAt": "...", "receiptUrl": "...", "createdAt": "..." }
    ],
    "cursor": "inv_...",
    "hasMore": true
  },
  "error": null,
  "meta": { ... }
}
```

`cursor` is `null` on the last page.

### Start a checkout

```
POST /api/v1/billing/checkout
```

Starts a Plugipay subscription for the chosen plan and returns the hosted [checkout session](https://plugipay.com/docs/api/resources/checkout-sessions) where the first invoice is paid.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `plan` | `STARTER` \| `GROWTH` \| `SCALE` | yes | The plan to subscribe to. |
| `email` | string | conditional | Required for an API-key (HMAC) caller, which has no email of its own; a signed-in session's email is used otherwise. The Plugipay-side customer is keyed off this. |
| `name` | string | no | Display name on the Plugipay receipt. |
| `currency` | `IDR` \| `USD` | no | Defaults by the caller's country: IDR in Indonesia, USD elsewhere. |

**Response** &mdash; `200 OK`

```json
{
  "data": {
    "subscriptionId": "sub_01HX...",
    "invoiceId": "inv_01HX...",
    "checkoutSessionId": "cs_01HX...",
    "checkoutUrl": "https://plugipay.com/c/cs_01HX..."
  },
  "error": null,
  "meta": { ... }
}
```

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Bad plan key, or `email` missing and not in JWT. |
| `503` | `PLAN_NOT_CONFIGURED` | Fulkruma's environment hasn't been wired with the Plugipay plan IDs yet (operator config error). |
| `500` | `CHECKOUT_FAILED` | Plugipay-side error. The message carries the upstream detail. |

### Cancel subscription

```
POST /api/v1/billing/cancel
```

Cancels the current Plugipay subscription at the end of the current period. No body. Returns the subscription as [`GET /billing/subscription`](#read-subscription) does, now with `status: "canceling"`; a workspace with no paid subscription gets its state back unchanged. A Plugipay-side failure is `500 CANCEL_FAILED`.

## Events

Billing-resource webhook events fire **from Plugipay**, not from Fulkruma &mdash; they arrive at Fulkruma's `/api/v1/webhooks/plugipay` inbound handler, which updates the local subscription state. If you need to mirror billing state into your own systems, subscribe to Plugipay's `invoice.paid`, `subscription.updated`, etc. directly. See [Plugipay's webhook docs](https://plugipay.com/docs/api/webhooks/events) for the catalog.

## Next

- [**Authentication**](/docs/api/authentication).
- [**Integrations**](/docs/api/resources/integrations) &mdash; check the Plugipay connection's health.
