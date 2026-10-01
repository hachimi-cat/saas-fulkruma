---
title: Webhooks
---

# Webhooks

Fulkruma posts JSON event notifications to URLs you register. Use them to mirror state into your own systems &mdash; fulfilment dashboards, CRMs, accounting &mdash; without polling.

This page covers **registering and managing endpoints**, **what a delivery looks like and how to verify it**, **retries**, and **the delivery log**. Per-event payload pages live under [`/docs/api/webhooks/events/<event.type>`](/docs/api/webhooks/events/fulkruma.shipment.created).

All management requests must be signed &mdash; see [**Authentication**](/docs/api/authentication).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/webhooks/endpoints` | List registered endpoints |
| `POST` | `/api/v1/webhooks/endpoints` | Register an endpoint |
| `PATCH` | `/api/v1/webhooks/endpoints/:id` | Update, pause or re-enable an endpoint |
| `DELETE` | `/api/v1/webhooks/endpoints/:id` | Delete an endpoint |
| `GET` | `/api/v1/webhooks/events` | List deliveries (the delivery log), with every attempt |
| `GET` | `/api/v1/webhooks/events/:id` | Get one delivery |
| `POST` | `/api/v1/webhooks/events/:id/retry` | Retry a delivery now |

### Register an endpoint

```
POST /api/v1/webhooks/endpoints
```

Registers a URL to receive events and returns the **signing secret** in plaintext &mdash; once, on this response only. Store it in your secrets manager and use it to verify the `Fulkruma-Signature` header on every delivery.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string (URL) | yes | Where Fulkruma POSTs. Must be `https://`, and must not point at a private, loopback or link-local address &mdash; see [Allowed URLs](#allowed-urls). |
| `events` | string[] | no | What to receive. Default `["*"]` (every event). Each entry is `"*"`, an event type (`"fulkruma.shipment.created.v1"`), or a prefix ending in `*` (`"fulkruma.shipment.*"` &mdash; every shipment event). Anything else (e.g. `"shipment.created"`) is a `400`. |
| `description` | string | no | Human label for the dashboard. |

**Response** &mdash; `201 Created`

```json
{
  "data": {
    "endpoint": {
      "id": "clx8n4p2q0001rw9v5m7t3k1z",
      "accountId": "acc_01HX...",
      "url": "https://your-app.com/webhooks/fulkruma",
      "events": ["fulkruma.shipment.*"],
      "description": "Production fulfilment listener",
      "active": true,
      "consecutiveFailures": 0,
      "failingSince": null,
      "disabledAt": null,
      "disabledReason": null,
      "createdAt": "2026-05-12T10:42:00.123Z",
      "updatedAt": "2026-05-12T10:42:00.123Z"
    },
    "secret": "whsec_AbCdEf1234567890XyZaBcDeF1234567890aBcDeF1234"
  },
  "error": null,
  "meta": { ... }
}
```

The top-level `secret` is present only on this `201` response &mdash; later reads return only `secretPreview` (`whsec_…last4`).

<blockquote class="callout-warn">

**Capture the secret immediately.** Pipe it to your secrets manager. To rotate, delete the endpoint and re-register; secret rotation in place is not yet supported.

</blockquote>

```bash
fulkruma_curl POST '/api/v1/webhooks/endpoints' \
  '{"url":"https://your-app.com/webhooks/fulkruma","events":["fulkruma.shipment.*"]}'
```

**Errors:** `400 VALIDATION` &mdash; a malformed body, an unknown `events` format, or a URL Fulkruma refuses (the message says why, e.g. `url: blocked: hooks.internal.example resolves to a private, loopback or link-local address (10.0.3.7)`).

### List endpoints

```
GET /api/v1/webhooks/endpoints
```

Returns every endpoint in the workspace, newest first. The plaintext `secret` is **never** included; `secretPreview` is. Each endpoint also carries its delivery health:

| Field | Description |
|---|---|
| `active` | `false` when paused by you or switched off by Fulkruma. |
| `consecutiveFailures` | Failed attempts in a row since the last `2xx`. |
| `failingSince` | When the current run of failures started; `null` while healthy. |
| `disabledAt`, `disabledReason` | Set when Fulkruma switched the endpoint off because it kept failing (see [Retries and failures](#retries-and-failures)); `null` for a manual pause. |

### Update an endpoint

```
PATCH /api/v1/webhooks/endpoints/:id
```

Partial update of `url`, `events`, `description`, `active`.

- `active: false` pauses delivery without losing the endpoint. Deliveries still queued for it become `failed`, and events that happen while it is paused are **not** queued for it.
- `active: true` re-enables it &mdash; also after Fulkruma switched it off &mdash; and resets `consecutiveFailures`, `failingSince`, `disabledAt` and `disabledReason`. Retry the deliveries you missed with [Retry a delivery](#retry-a-delivery).
- A new `url` goes through the same checks as on register. The signing secret stays the same.

### Delete an endpoint

```
DELETE /api/v1/webhooks/endpoints/:id
```

Hard-deletes the endpoint and its delivery log, and stops further deliveries.

### List deliveries

```
GET /api/v1/webhooks/events
```

The delivery log, newest first: one row per event per endpoint, with every attempt made at it. Useful for debugging "did the event fire, and what did my server answer?" without trawling your own logs.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `limit` | integer | 1&ndash;200, default 50. |
| `cursor` | string | The `nextCursor` of the previous page. |
| `type` | string | Only this event type, e.g. `fulkruma.shipment.created.v1`. |
| `status` | `pending` \| `sent` \| `failed` | Only deliveries in this state. |
| `endpointId` | string | Only deliveries to this endpoint. |

```json
{
  "data": {
    "events": [
      {
        "id": "clx9q2r7s0004rw9v1c8d2e3f",
        "accountId": "acc_01HX...",
        "endpointId": "clx8n4p2q0001rw9v5m7t3k1z",
        "eventId": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "type": "fulkruma.shipment.created.v1",
        "payload": { "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z", "type": "fulkruma.shipment.created.v1", "...": "..." },
        "status": "pending",
        "attempts": 2,
        "lastAttemptAt": "2026-05-12T10:43:01.500Z",
        "nextRetryAt": "2026-05-12T10:48:01.500Z",
        "responseCode": 503,
        "responseBody": "upstream unavailable",
        "lastError": "HTTP 503",
        "durationMs": 87,
        "deliveredAt": null,
        "createdAt": "2026-05-12T10:42:00.200Z",
        "updatedAt": "2026-05-12T10:43:01.500Z",
        "deliveryAttempts": [
          { "attemptNumber": 1, "status": "failed", "responseCode": 503, "durationMs": 91, "error": "HTTP 503", "nextRetryAt": "2026-05-12T10:43:01.300Z", "attemptedAt": "2026-05-12T10:42:01.300Z", "...": "..." },
          { "attemptNumber": 2, "status": "failed", "responseCode": 503, "durationMs": 87, "error": "HTTP 503", "nextRetryAt": "2026-05-12T10:48:01.500Z", "attemptedAt": "2026-05-12T10:43:01.500Z", "...": "..." }
        ]
      }
    ],
    "nextCursor": "clx9q2r7s0004rw9v1c8d2e3f"
  },
  "error": null,
  "meta": { ... }
}
```

| Field | Description |
|---|---|
| `eventId` | The event's `evt_…` id &mdash; the `id` in the body you received. The same on every attempt. |
| `payload` | The envelope sent (see [What a delivery looks like](#what-a-delivery-looks-like)). |
| `status` | `pending` &mdash; queued: not attempted yet, or a retry is scheduled at `nextRetryAt`. `sent` &mdash; your endpoint answered `2xx`. `failed` &mdash; given up: every attempt failed, or the endpoint was paused / switched off. |
| `attempts` | How many attempts were made. |
| `responseCode`, `responseBody` | Your server's last status code and the first 2 KiB of its last response. `responseCode` is `null` when no response came back. |
| `lastError` | Why the last attempt failed: `HTTP 503`, `timed out after 10000ms`, `connect ECONNREFUSED …`, `redirect not followed (HTTP 302)`, `blocked: …`, `endpoint is disabled`. |
| `durationMs` | How long the last attempt took. |
| `deliveredAt` | When it was answered with `2xx`. |
| `deliveryAttempts` | Every attempt, oldest first: `attemptNumber`, `status` (`succeeded` / `failed`), `responseCode`, `durationMs`, `error`, `nextRetryAt` (the retry that failure scheduled; `null` on success or give-up), `attemptedAt`. |
| `nextCursor` | Pass as `cursor` for the next page; `null` on the last. |

```bash
fulkruma_curl GET '/api/v1/webhooks/events?status=failed&limit=20'
```

### Get a delivery

```
GET /api/v1/webhooks/events/:id
```

One row of the log (`{ "event": { ... } }`), with every attempt. `404` for an id outside your workspace.

### Retry a delivery

```
POST /api/v1/webhooks/events/:id/retry
```

Queues one more attempt now &mdash; for a `failed` delivery once your handler is fixed, or to send a `sent` one again. Responds `202 Accepted` with the row in `pending`; the attempt goes out within a few seconds, so read it back with [Get a delivery](#get-a-delivery). If that attempt fails too, any scheduled retries it has left follow; a delivery that already used all six attempts gets just this one.

**Errors:** `404 NOT_FOUND`; `409 ALREADY_QUEUED` (it is `pending`); `409 ENDPOINT_DISABLED` (re-enable the endpoint first).

## What a delivery looks like

```
POST https://your-app.com/webhooks/fulkruma
Content-Type: application/json
User-Agent: Fulkruma-Webhooks/1.0
Fulkruma-Signature: t=1715526783,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
Fulkruma-Event-Id: evt_01HXAB7K3M9N2P5QRS8TVWXY3Z
Fulkruma-Event-Type: fulkruma.shipment.created.v1
Fulkruma-Delivery-Id: clx9q2r7s0004rw9v1c8d2e3f
Fulkruma-Delivery-Attempt: 1

{"id":"evt_01HXAB7K3M9N2P5QRS8TVWXY3Z","type":"fulkruma.shipment.created.v1","occurredAt":"2026-05-12T10:42:00.123Z","accountId":"acc_01HX...","data":{ ... },"metadata":{}}
```

| Header | Description |
|---|---|
| `Fulkruma-Signature` | `t=<unix seconds>,v1=<hex>` &mdash; see [Signature verification](#signature-verification). |
| `Fulkruma-Event-Id` | The event id (also the body's `id`). |
| `Fulkruma-Event-Type` | The event type (also the body's `type`). |
| `Fulkruma-Delivery-Id` | The row in the [delivery log](#list-deliveries). |
| `Fulkruma-Delivery-Attempt` | `1` for the first attempt, `2`+ for retries. |

### Event envelope

Every event uses the same outer envelope, with the resource-specific payload inside `data`:

| Field | Type | Description |
|---|---|---|
| `id` | string (`evt_…`) | Unique event ID. The same on every retry, and for every endpoint that receives it. Use it as your idempotency key. |
| `type` | string | The event type, e.g. `fulkruma.shipment.created.v1`. The version suffix lets Fulkruma evolve payloads safely. |
| `occurredAt` | string (ISO 8601 UTC) | When the underlying state change happened. |
| `accountId` | string | The workspace the event belongs to. |
| `data` | object | Resource-specific payload. See the per-event pages. |
| `metadata` | object | Reserved for future use (correlation IDs, partner-routing hints). Currently `{}`. |

### Who receives an event

An event goes to every endpoint that is, at the moment it is sent out:

- in **the same workspace** as the event &mdash; never to another workspace's endpoints;
- **active** (not paused, not switched off);
- subscribed to it: `"*"`, its exact type, or a matching prefix (`"fulkruma.shipment.*"`);
- registered **before the event happened** &mdash; a new endpoint does not receive earlier events.

The first attempt goes out within a couple of seconds of the state change committing.

## Signature verification

Every delivery carries:

```
Fulkruma-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>
```

where `v1 = HMAC-SHA256(secret, "<t>.<raw request body>")`, hex-encoded, keyed with the endpoint's `whsec_…` secret as UTF-8. To verify:

1. Read `t` and `v1` from the header (split on `,`, then on the first `=`).
2. Reject the request if `t` is more than 300 seconds from your clock (replay protection).
3. Compute `HMAC-SHA256(secret, t + "." + rawBody)` over the **raw bytes** you received &mdash; not the body re-serialised from parsed JSON, which changes whitespace and escaping.
4. Constant-time-compare it with `v1`.

The SDKs do all of this: `verifyWebhook` ([Node](/docs/sdk/node/resources/webhooks#verify-inbound-deliveries)), `verify_webhook` ([Python](/docs/sdk/python/resources/webhooks)), `VerifyWebhook` ([Go](/docs/sdk/go/resources/webhooks)). By hand:

```js
// Node — rawBody is the Buffer from express.raw({ type: 'application/json' })
import crypto from 'node:crypto';

function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const { t, v1 } = parts;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex');
  return expected.length === v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

```python
# Python
import hashlib, hmac, time

def verify(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(kv.strip().split("=", 1) for kv in header.split(",") if "=" in kv)
    t, v1 = parts.get("t"), parts.get("v1")
    if not t or not v1:
        return False
    if abs(time.time() - int(t)) > 300:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)
```

## Retries and failures

**Success** is any `2xx` response within **10 seconds**. Anything else is a failed attempt: another status, a timeout, a refused or reset connection, a TLS error, or a redirect &mdash; **redirects are never followed**, so point the endpoint at the final URL.

**Retries** follow a fixed schedule, each measured from the attempt before it:

| Attempt | When |
|---|---|
| 1 | Within a couple of seconds of the event |
| 2 | 1 minute after attempt 1 failed |
| 3 | 5 minutes later |
| 4 | 25 minutes later |
| 5 | 2 hours later |
| 6 | 12 hours later |

After the sixth failure (about 14&frac12; hours in) the delivery is `failed` and stays so until you [retry it](#retry-a-delivery).

- **At-least-once.** A timeout can fail an attempt your server actually processed, so the same event can arrive more than once. Dedupe on the body's `id` (or `Fulkruma-Event-Id`) &mdash; a `processed_events` table with a unique constraint is the canonical guard.
- **Acknowledge fast.** If your handler needs longer than a few seconds, queue the work and return `200` immediately.
- **Endpoints that keep failing are switched off.** When an endpoint has failed **20 attempts in a row** and has been failing for **at least 24 hours**, Fulkruma sets `active: false` with `disabledAt` and `disabledReason`, marks its queued deliveries `failed`, and records a `webhook.auto_disabled` entry in the [audit log](/docs/api/resources/audit-log). Both conditions must hold, so a short outage &mdash; a deploy, a few minutes of errors while events are busy &mdash; never switches anyone off; the retries ride it out. Fix the receiver, re-enable the endpoint (`PATCH … {"active": true}`), then retry what you missed (`GET /webhooks/events?endpointId=…&status=failed`). The switch-off also raises [`fulkruma.webhook_endpoint.disabled.v1`](/docs/api/webhooks/events/fulkruma.webhook_endpoint.disabled), delivered to your *other* endpoints that subscribe to it &mdash; so point a second endpoint (or an alerting service) at it &mdash; or watch `active` on [List endpoints](#list-endpoints) or the audit log.

## Allowed URLs

Fulkruma makes the request from its own servers, so it refuses targets on private networks:

- `https://` only. (`http://` is accepted only by a local development server.)
- The host may not be `localhost` or end in `.localhost`, `.local` or `.internal`, and **every** address it resolves to must be public: loopback (`127.0.0.0/8`, `::1`), private (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), carrier-grade NAT (`100.64/10`), link-local (`169.254/16` &mdash; including cloud metadata &mdash; and `fe80::/10`), unspecified, multicast, reserved and documentation ranges are refused, as are IPv4-mapped forms of those.
- The check runs when you register or change the URL **and again on every delivery**, against the address the connection actually uses &mdash; a hostname that later resolves somewhere private fails that attempt with `blocked: …` in `lastError`.

To receive webhooks on your own machine during development, expose it through a public HTTPS tunnel (ngrok, Cloudflare Tunnel, …) and register the tunnel's URL.

## Ordering

Not guaranteed. Deliveries run concurrently, and a retried delivery arrives after events that happened later. Use `occurredAt` and the resource's own state (`GET` it) when order matters &mdash; e.g. ignore a `fulkruma.shipment.status_updated.v1` whose `occurredAt` is older than the last one you applied.

## Event catalog

Emitted today:

| Event type | When | Page |
|---|---|---|
| `fulkruma.product.created.v1` | A product is created. | [&rarr;](/docs/api/webhooks/events/fulkruma.product.created) |
| `fulkruma.product.updated.v1` | A product's fields change. | [&rarr;](/docs/api/webhooks/events/fulkruma.product.updated) |
| `fulkruma.product.archived.v1` | A product is archived. | [&rarr;](/docs/api/webhooks/events/fulkruma.product.archived) |
| `fulkruma.variant.created.v1` | A variant is added to a product. | [&rarr;](/docs/api/webhooks/events/fulkruma.variant.created) |
| `fulkruma.variant.archived.v1` | A variant is archived. | [&rarr;](/docs/api/webhooks/events/fulkruma.variant.archived) |
| `fulkruma.warehouse.created.v1` | A warehouse is created. | [&rarr;](/docs/api/webhooks/events/fulkruma.warehouse.created) |
| `fulkruma.stock.adjusted.v1` | A stock level changes. | [&rarr;](/docs/api/webhooks/events/fulkruma.stock.adjusted) |
| `fulkruma.stock.low.v1` | A stock level falls below its variant's `lowStockThreshold` (once per crossing). | [&rarr;](/docs/api/webhooks/events/fulkruma.stock.low) |
| `fulkruma.shipment.created.v1` | A shipment (draft) is created. | [&rarr;](/docs/api/webhooks/events/fulkruma.shipment.created) |
| `fulkruma.shipment.pickup_confirmed.v1` | A draft is confirmed and booked with the courier. | [&rarr;](/docs/api/webhooks/events/fulkruma.shipment.pickup_confirmed) |
| `fulkruma.shipment.status_updated.v1` | The courier reports a new status (picked up, in transit, delivered, returned, …). | [&rarr;](/docs/api/webhooks/events/fulkruma.shipment.status_updated) |
| `fulkruma.shipment.cancelled.v1` | A shipment is cancelled (shipping credit refunded when it was charged). | [&rarr;](/docs/api/webhooks/events/fulkruma.shipment.cancelled) |
| `fulkruma.shipment.rebooked.v1` | A dead shipment is rebooked as a new one. | [&rarr;](/docs/api/webhooks/events/fulkruma.shipment.rebooked) |
| `fulkruma.delivery.created.v1` | A digital-delivery grant is issued. | [&rarr;](/docs/api/webhooks/events/fulkruma.delivery.created) |
| `fulkruma.delivery.updated.v1` | A delivery is extended, its downloads reset, or revoked. | [&rarr;](/docs/api/webhooks/events/fulkruma.delivery.updated) |
| `fulkruma.delivery.downloaded.v1` | A download of a delivery is recorded. | [&rarr;](/docs/api/webhooks/events/fulkruma.delivery.downloaded) |
| `fulkruma.delivery.expired.v1` | A delivery's download window closed (expired or revoked). | [&rarr;](/docs/api/webhooks/events/fulkruma.delivery.expired) |
| `fulkruma.license.issued.v1` | A license key is issued. | [&rarr;](/docs/api/webhooks/events/fulkruma.license.issued) |
| `fulkruma.license.revoked.v1` | A license key is revoked. | [&rarr;](/docs/api/webhooks/events/fulkruma.license.revoked) |
| `fulkruma.license.activated.v1` | A license key is bound to a new instance. | [&rarr;](/docs/api/webhooks/events/fulkruma.license.activated) |
| `fulkruma.license.deactivated.v1` | An instance is unbound from a license key. | [&rarr;](/docs/api/webhooks/events/fulkruma.license.deactivated) |
| `fulkruma.webhook_endpoint.disabled.v1` | Fulkruma switches off one of your endpoints that kept failing (sent to your other endpoints). | [&rarr;](/docs/api/webhooks/events/fulkruma.webhook_endpoint.disabled) |

A delivered, returned or failed parcel arrives as `fulkruma.shipment.status_updated.v1` with that `status` &mdash; there is no separate `delivered` event.

## Next

- Per-event pages under [`/docs/api/webhooks/events/`](/docs/api/webhooks/events/fulkruma.shipment.created).
- [**Webhooks reference**](/docs/api/reference/webhooks) &mdash; every route's parameters, generated from the code.
- [**Authentication**](/docs/api/authentication) &mdash; how to sign management requests (a different scheme from the webhook signature).
