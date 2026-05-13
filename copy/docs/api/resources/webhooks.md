---
title: Webhooks
---

# Webhooks

Fulkruma posts JSON event notifications to URLs you register. Use them to mirror state into your own systems &mdash; fulfilment dashboards, CRMs, accounting &mdash; without polling.

This page covers **registering and managing endpoints** plus the event delivery envelope. Per-event payload pages live under [`/docs/api/webhooks/events/<event.type>`](/docs/api/webhooks/events/fulkruma.shipment.created).

All endpoint-management requests must be signed &mdash; see [**Authentication**](/docs/api/authentication).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/webhooks/endpoints` | List registered endpoints |
| `POST` | `/api/v1/webhooks/endpoints` | Register an endpoint |
| `PATCH` | `/api/v1/webhooks/endpoints/:id` | Update an endpoint |
| `DELETE` | `/api/v1/webhooks/endpoints/:id` | Delete an endpoint |
| `GET` | `/api/v1/webhooks/events` | List recent delivery attempts (last 50) |

### Register an endpoint

```
POST /api/v1/webhooks/endpoints
```

Registers a URL to receive events and returns the **signing secret** in plaintext &mdash; once, on this response only. Store it in your secrets manager and use it to verify the `Fulkruma-Signature` header on inbound deliveries.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string (URL) | yes | The HTTPS endpoint Fulkruma will POST to. HTTP is allowed for development against `staging.fulkruma.com` only. |
| `events` | string[] | no | Event types to subscribe to. Default `["*"]` (all). Pass an explicit list (e.g. `["fulkruma.shipment.created.v1", "fulkruma.shipment.delivered.v1"]`) to filter. |
| `description` | string | no | Human label for the dashboard. |

**Response** &mdash; `201 Created`

```json
{
  "data": {
    "endpoint": {
      "id": "we_01HXAB7K3M9N2P5QRS8TVWXY3Z",
      "accountId": "acc_01HX...",
      "url": "https://your-app.com/webhooks/fulkruma",
      "events": ["*"],
      "description": "Production fulfilment listener",
      "active": true,
      "createdAt": "2026-05-12T10:42:00.123Z"
    },
    "secret": "whsec_AbCdEf1234567890XyZaBcDeF1234567890aBcDeF1234"
  },
  "error": null,
  "meta": { ... }
}
```

The top-level `secret` is present only on this `201` response &mdash; subsequent reads return only `secretPreview` (`whsec_…last4`).

<blockquote class="callout-warn">

**Capture the secret immediately.** Pipe it to your secrets manager. To rotate, delete the endpoint and re-register; secret rotation in place is not yet supported.

</blockquote>

```bash
fulkruma_curl POST '/api/v1/webhooks/endpoints' \
  '{"url":"https://your-app.com/webhooks/fulkruma","events":["fulkruma.shipment.created.v1"]}'
```

### List endpoints

```
GET /api/v1/webhooks/endpoints
```

Returns every endpoint in the workspace. The plaintext `secret` is **never** included; `secretPreview` is.

### Update an endpoint

```
PATCH /api/v1/webhooks/endpoints/:id
```

Partial update. Pass `active: false` to temporarily disable delivery without losing the row. Updating `url` keeps the same signing secret &mdash; rotate by delete + re-register if you want a fresh secret.

### Delete an endpoint

```
DELETE /api/v1/webhooks/endpoints/:id
```

Hard-deletes the endpoint row and stops further deliveries.

### List recent deliveries

```
GET /api/v1/webhooks/events
```

Returns the last 50 delivery attempts (across endpoints), newest first. Useful for debugging "did the event fire?" without trawling your own server logs.

```json
{
  "data": {
    "events": [
      {
        "id": "wev_01HX...",
        "accountId": "acc_01HX...",
        "endpointId": "we_01HX...",
        "eventId": "evt_01HX...",
        "type": "fulkruma.shipment.created.v1",
        "status": "delivered",
        "attempts": 1,
        "lastAttemptAt": "2026-05-12T10:42:01.500Z",
        "responseStatus": 200,
        "createdAt": "2026-05-12T10:42:01.000Z"
      }
    ]
  },
  "error": null,
  "meta": { ... }
}
```

## Event envelope

Every event Fulkruma fires uses the same outer envelope, with the resource-specific payload inside `data`:

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.shipment.created.v1",
  "occurredAt": "2026-05-12T10:42:00.123Z",
  "accountId": "acc_01HX...",
  "data": { /* resource-specific */ },
  "metadata": {}
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string (`evt_…`) | Unique event ID. Stable across retries. Use as your idempotency key. |
| `type` | string | The event type, e.g. `fulkruma.shipment.created.v1`. Version suffix lets Fulkruma evolve payloads safely. |
| `occurredAt` | string (ISO 8601 UTC) | When the underlying state change happened. |
| `accountId` | string \| null | The workspace this event belongs to. `null` for platform-level events. |
| `data` | object | Resource-specific payload. See the per-event pages. |
| `metadata` | object | Reserved for future use (correlation IDs, partner-routing hints). |

## Signature verification

Every delivery carries a `Fulkruma-Signature` header with the format:

```
Fulkruma-Signature: t=1715526783, v1=<hex-hmac>
```

To verify:

1. Read the timestamp `t` and check it's within 300 seconds of your server time.
2. Build the signed string: `<t>.<raw request body>`.
3. Compute `HMAC-SHA256(secret, signedString)`.
4. Constant-time-compare with the `v1` value.

```js
// Node
import crypto from 'node:crypto';

function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(
    header.split(',').map((s) => s.trim().split('='))
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(`${t}.${rawBody}`)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

```python
# Python
import hmac, hashlib, time

def verify(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(s.strip().split('=') for s in header.split(','))
    t, v1 = parts.get('t'), parts.get('v1')
    if not t or not v1:
        return False
    if abs(time.time() - int(t)) > 300:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)
```

## Retry policy

- **At-least-once.** Fulkruma retries non-2xx responses with exponential backoff: 1s, 5s, 25s, 2m, 10m, 1h, 6h.
- **Disable after 7 days of failure.** If every retry over 7 days fails, the endpoint is auto-disabled (`active: false`) and a `webhook_endpoint.disabled` event fires (reserved &mdash; not yet emitted).
- **Acknowledge fast.** Return `200` (or any 2xx) within 10 seconds. Anything else counts as a failure. If your handler needs longer, queue the work asynchronously and acknowledge immediately.
- **Dedupe on `event.id`.** Retries reuse the same `evt_…` ID. Storing it in a `processed_events` table with a unique constraint is the canonical guard against double-handling.

## Ordering

Events fire in the order their underlying state changes commit, **per resource**. Cross-resource ordering is **not** guaranteed &mdash; you may see `fulkruma.delivery.created.v1` for a checkout before the related `fulkruma.product.created.v1` if the product was provisioned in the same transaction. Use `occurredAt` and resource IDs to reconcile when ordering matters.

## Event catalog

Currently emitted:

| Event type | Resource | Page |
|---|---|---|
| `fulkruma.product.created.v1` | [Products](/docs/api/resources/products) | [&rarr;](/docs/api/webhooks/events/fulkruma.product.created) |
| `fulkruma.stock.adjusted.v1` | [Stock](/docs/api/resources/stock) | [&rarr;](/docs/api/webhooks/events/fulkruma.stock.adjusted) |
| `fulkruma.shipment.created.v1` | [Shipments](/docs/api/resources/shipments) | [&rarr;](/docs/api/webhooks/events/fulkruma.shipment.created) |
| `fulkruma.delivery.created.v1` | [Deliveries](/docs/api/resources/deliveries) | [&rarr;](/docs/api/webhooks/events/fulkruma.delivery.created) |
| `fulkruma.license.issued.v1` | [Licenses](/docs/api/resources/licenses) | [&rarr;](/docs/api/webhooks/events/fulkruma.license.issued) |
| `fulkruma.license.revoked.v1` | [Licenses](/docs/api/resources/licenses) | [&rarr;](/docs/api/webhooks/events/fulkruma.license.revoked) |

Reserved (subscribe defensively):

- `fulkruma.shipment.delivered.v1`
- `fulkruma.shipment.cancelled.v1`
- `fulkruma.stock.low.v1`
- `fulkruma.warehouse.created.v1`

## Next

- Per-event pages under [`/docs/api/webhooks/events/`](/docs/api/webhooks/events/fulkruma.shipment.created).
- [**Authentication**](/docs/api/authentication) &mdash; HMAC signing recipe (different scheme from webhook signature; the page distinguishes).
