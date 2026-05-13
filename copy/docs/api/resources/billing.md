---
title: Billing
---

# Billing

The **billing** resource is Fulkruma's own subscription surface &mdash; it tells you what plan the merchant is on, how much they've used in the current period, recent invoices, and how to launch the Plugipay-hosted checkout for a plan change. It's not about charging the merchant's buyers; it's about charging the merchant for Fulkruma itself.

Plans are billed through Plugipay (see `project_forjio_plugipay_storlaunch_integration.md` for the Pattern 2 partner-billing design). Fulkruma never holds card data; Plugipay does.

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

Public &mdash; no auth. Returns the available plan catalog with limits and pricing. Used by the marketing site's pricing section and the dashboard's plan picker.

```json
{
  "data": {
    "plans": [
      {
        "key": "STARTER",
        "name": "Starter",
        "priceCents": 990000,
        "currency": "IDR",
        "interval": "month",
        "limits": {
          "warehousesMax": 1,
          "skusMax": 100,
          "shipmentsPerMonth": 200,
          "licensesPerMonth": 50
        }
      }
    ]
  },
  "error": null,
  "meta": { ... }
}
```

### Read current plan

```
GET /api/v1/billing/plan
```

Returns the merchant's current plan, with derived "approaching limit" flags for dashboard surfacing.

### Read subscription

```
GET /api/v1/billing/subscription
```

Returns the Plugipay-side view: status (`active`, `past_due`, `cancelled`), current period end, next-bill amount.

### Current-period usage

```
GET /api/v1/billing/usage
```

Returns counters for the current billing period: shipments created, licenses issued, deliveries created. Resets on period boundary. Powers the dashboard's "X of Y used" widgets.

### List invoices

```
GET /api/v1/billing/invoices
```

Cursor-paginated; up to `limit=50` per page (default 20). Lists the merchant's past Fulkruma invoices, mirrored from Plugipay's invoice resource.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `limit` | integer | Page size. Capped at `50`. |
| `cursor` | string | The previous page's `meta.cursor`. |

### Start a checkout

```
POST /api/v1/billing/checkout
```

Creates a Plugipay [checkout session](https://plugipay.com/docs/api/resources/checkout-sessions) for the chosen plan and returns the hosted-checkout URL to redirect the merchant to.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `plan` | `STARTER` \| `GROWTH` \| `SCALE` | yes | The plan to subscribe to. |
| `email` | string | conditional | Required if not present in the JWT claim. The Plugipay-side customer is keyed off this. |
| `name` | string | no | Display name on the Plugipay receipt. |

**Response** &mdash; `200 OK`

```json
{
  "data": {
    "url": "https://plugipay.com/c/cs_01HX...",
    "checkoutSessionId": "cs_01HX...",
    "subscriptionId": null
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

Cancels the current Plugipay subscription. The subscription stays active until the end of the current period, then drops to `cancelled`. No body.

## Events

Billing-resource webhook events fire **from Plugipay**, not from Fulkruma &mdash; they arrive at Fulkruma's `/api/v1/webhooks/plugipay` inbound handler, which updates the local subscription state. If you need to mirror billing state into your own systems, subscribe to Plugipay's `invoice.paid`, `subscription.updated`, etc. directly. See [Plugipay's webhook docs](https://plugipay.com/docs/api/webhooks/events) for the catalog.

## Next

- [**Authentication**](/docs/api/authentication).
- [**Integrations**](/docs/api/resources/integrations) &mdash; check the Plugipay connection's health.
