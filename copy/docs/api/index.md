---
title: API reference
---

# API reference

The Fulkruma API is a REST API that uses JSON for both requests and responses. It's the same API our portal and SDKs use; if you want to integrate Fulkruma directly without an SDK, this section covers everything you need.

## Base URL

```
https://fulkruma.com
```

All API paths are prefixed with `/api/v1/`. Example:

```
https://fulkruma.com/api/v1/warehouses
```

For staging:

```
https://staging.fulkruma.com
```

You can get staging keys from us &mdash; email hello@fulkruma.com.

## Authentication

Every request must be signed. The Fulkruma API uses **HMAC-SHA256 request signing** with an access key ID + secret pair.

Two headers per request:

| Header | What it is |
|---|---|
| `Authorization` | `Fulkruma-HMAC-SHA256 keyId=<id>, scope=*, signature=<hex>` |
| `X-Fulkruma-Timestamp` | Current epoch seconds (must be within 300 seconds of server time) |

Access key IDs are prefixed `AKIAFULK*`; secrets are random base64-style strings.

The signing string is:

```
<METHOD>
<path>
<timestamp>
<sha256-hex(body)>
[<idempotency-key>]    (optional, if present)
```

See [**API authentication**](/docs/api/authentication) for the full signing recipe with worked examples.

The SDKs handle all this transparently. You only need to compute signatures manually with raw HTTP.

## Pattern 2 partner billing

If you're a Forjio partner (Storlaunch, Ripllo, etc.) calling Fulkruma on behalf of a merchant workspace, your access key holds the `fulkruma:platform:admin` scope and you pass an extra header:

```
X-Fulkruma-On-Behalf-Of: acc_<merchantWorkspaceId>
```

All operations are then scoped to the merchant's workspace, but billed and audited under the partner. This is how Storlaunch integrates Fulkruma as a fulfilment module.

See [**API authentication**](/docs/api/authentication) for the full pattern.

## Response envelope

Every successful API response is wrapped in a uniform envelope:

```json
{
  "data": { /* the response payload */ },
  "error": null,
  "meta": {
    "requestId": "req_01H...",
    "timestamp": "2026-05-12T10:42:00Z"
  }
}
```

Errors keep the envelope shape but set `error`:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION",
    "message": "name must be 1-120 characters",
    "field": "name"
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

Common error codes:

| Code | Means |
|---|---|
| `VALIDATION` | Body or query parameter is malformed |
| `NOT_FOUND` | Resource ID doesn't exist (or belongs to another workspace) |
| `NO_ACCOUNT` | Token is missing an `accountId` claim |
| `STOCK_INSUFFICIENT` | Tried to ship/reserve more than available |
| `LICENSE_REVOKED` | Activation/validation attempted on a revoked key |
| `INTEGRATION_ERROR` | Biteship or another upstream returned an error |

## Idempotency

Mutating endpoints (POST, PUT, PATCH, DELETE) accept an `Idempotency-Key` header. If you send the same key twice within 24 hours, you get back the same response &mdash; no duplicate operation.

```bash
curl -X POST https://fulkruma.com/api/v1/shipments \
  -H "Idempotency-Key: order-2026-05-12-001" \
  -H "Authorization: Fulkruma-HMAC-SHA256 ..." \
  -H "X-Fulkruma-Timestamp: ..." \
  ...
```

Use idempotency keys for any operation that causes side effects: shipment creation, stock adjustments, license issuance, delivery creation. The SDKs auto-generate idempotency keys for `create` calls.

## Resources

The API is organized by resource:

| Resource | Path prefix |
|---|---|
| Warehouses | `/api/v1/warehouses` |
| Products | `/api/v1/products` |
| Stock | `/api/v1/stock` |
| Addresses | `/api/v1/addresses` |
| Shipments | `/api/v1/shipments` |
| Shipping (rates/origin/couriers) | `/api/v1/shipping` |
| Deliveries | `/api/v1/deliveries` |
| Licenses | `/api/v1/licenses` |
| API keys | `/api/v1/api-keys` |
| Webhooks | `/api/v1/webhooks` |
| Audit log | `/api/v1/audit-log` |
| Stats / overview | `/api/v1/stats` |
| Integrations status | `/api/v1/integrations` |
| Billing | `/api/v1/billing` |
| Admin (Pattern 2) | `/api/v1/admin` |

Each resource follows the same shape: `GET /` to list, `POST /` to create, `GET /:id` to fetch, `PATCH /:id` to update, `DELETE /:id` to archive.

## Public license endpoints

Three license endpoints are **unauthenticated** &mdash; they're meant to be called by customer-facing software using only the license key:

- `POST /api/v1/licenses/activate` &mdash; bind a license key to an instance ID.
- `POST /api/v1/licenses/deactivate` &mdash; release an instance.
- `GET /api/v1/licenses/validate` &mdash; check if a license is still valid.

These don't need an HMAC signature. The key itself is the credential.

## Webhooks

Fulkruma sends webhook events for state changes: `warehouse.created`, `stock.low`, `shipment.delivered`, `license.activated`, and so on.

Events are signed; you verify the signature before trusting the payload. Configure endpoints under **Dashboard &rarr; Webhooks** or via `POST /api/v1/webhooks/endpoints`.

## Health check

A public health endpoint is at `GET /api/v1/health` &mdash; no auth required. Returns `200` with the service name and version. Useful for uptime monitoring.

## Next

- [**Authentication**](/docs/api/authentication) &mdash; the full HMAC signing recipe with worked examples.
- [**SDKs**](/docs/sdk) &mdash; if you'd rather not implement signing yourself.
- [**Concepts**](/docs/concepts) &mdash; the data model the API exposes.
