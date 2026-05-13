---
title: API resources
---

# API resources

Every resource group exposed by the Fulkruma API, with a link to its per-resource page. Each per-resource page documents every endpoint with method, path, parameters, response shape, and error codes.

If you're new to the API, read [**Authentication**](/docs/api/authentication) and the [**API overview**](/docs/api) first &mdash; the per-resource pages assume you know them.

## Fulfilment

| Resource | What |
|---|---|
| [**Warehouses**](/docs/api/resources/warehouses) | Stock locations. Stock levels and shipments hang off these. |
| [**Products**](/docs/api/resources/products) | Items you sell, with variants, SKUs, and physical/digital/license type. |
| [**Stock**](/docs/api/resources/stock) | Per-variant per-warehouse quantity, reservations, and the audit-trail of movements. |
| [**Shipments**](/docs/api/resources/shipments) | Physical orders routed through Biteship couriers. |
| [**Shipping**](/docs/api/resources/shipping) | Rate quotes, courier catalog, origin config, label fetch, tracking. |
| [**Deliveries**](/docs/api/resources/deliveries) | Time-limited download grants for digital products. |
| [**Licenses**](/docs/api/resources/licenses) | License keys with activation/deactivation and validation. |
| [**Addresses**](/docs/api/resources/addresses) | Saved buyer destination addresses. |

## Identity &amp; access

| Resource | What |
|---|---|
| [**API keys**](/docs/api/resources/api-keys) | HMAC credentials for server-to-server auth. |
| [**Webhooks**](/docs/api/resources/webhooks) | Where Fulkruma POSTs event notifications. |
| [**Audit log**](/docs/api/resources/audit-log) | Read-only history of every workspace mutation. |

## Operations

| Resource | What |
|---|---|
| [**Billing**](/docs/api/resources/billing) | Plan, subscription, usage, and Plugipay-checkout for your Fulkruma subscription. |
| [**Integrations**](/docs/api/resources/integrations) | Aggregated runtime signals for connected systems (Biteship, Plugipay, Storlaunch). |

## Reading these pages

Each resource page follows the same shape:

1. **Overview** &mdash; what the resource is, how it relates to others.
2. **Endpoints** &mdash; one section per method.
3. **Per-endpoint** &mdash; method + path, request parameters table, response example, error codes specific to this operation.
4. **The object** &mdash; the full field reference for the resource.
5. **Events** &mdash; which webhook events this resource produces.

## Where to find things

- **Webhook event types?** [**Webhooks**](/docs/api/resources/webhooks) has the full catalog.
- **Status codes and error codes?** The [**API overview**](/docs/api#response-envelope) lists the common ones; per-endpoint errors live on each resource page.
- **HMAC signing recipe?** [**Authentication**](/docs/api/authentication).
- **Pattern 2 partner billing?** Each endpoint mentions whether `X-Fulkruma-On-Behalf-Of` is honored.

## Coverage notes

Some endpoints exist in the backend but aren't documented here because they're internal:

- `/api/v1/webhooks/biteship` &mdash; inbound tracking events from Biteship.
- `/api/v1/webhooks/plugipay` &mdash; inbound subscription/payment events from Plugipay.
- `/api/v1/webhooks/storlaunch` &mdash; inbound product-sync events from Storlaunch.
- `/api/v1/admin/*` &mdash; Pattern 2 partner provisioning (used by Storlaunch's CI; partner-side reference only).
- `/api/v1/stats/*` &mdash; dashboard counters; same data is available by listing the underlying resources.

If you need access to one of these, email **hello@fulkruma.com**.
