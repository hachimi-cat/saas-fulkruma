---
title: Webhooks — reference
---

# Webhooks

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/webhooks/endpoints` | [List endpoints](#list-endpoints) |
| `POST` | `/api/v1/webhooks/endpoints` | [Register an endpoint.](#register-an-endpoint) |
| `DELETE` | `/api/v1/webhooks/endpoints/{id}` | [Delete an endpoint](#delete-an-endpoint) |
| `PATCH` | `/api/v1/webhooks/endpoints/{id}` | [Update an endpoint.](#update-an-endpoint) |
| `GET` | `/api/v1/webhooks/events` | [List webhook deliveries.](#list-webhook-deliveries) |
| `GET` | `/api/v1/webhooks/events/{id}` | [Get a webhook delivery.](#get-a-webhook-delivery) |
| `POST` | `/api/v1/webhooks/events/{id}/retry` | [Retry a webhook delivery.](#retry-a-webhook-delivery) |

## List endpoints

```
GET /api/v1/webhooks/endpoints
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/webhooks/endpoints" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Register an endpoint.

```
POST /api/v1/webhooks/endpoints
```

Register an endpoint. The response is the only time its signing secret
is returned. The URL must be https (in production) and must not point
at a private, loopback or link-local address. `events` takes "*",
event types ("fulkruma.shipment.created.v1") and prefixes
("fulkruma.shipment.*").

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string (uri) | yes | max length 2000 |
| `events` | array of string | no | default `["*"]` |
| `description` | string | no | max length 500 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/webhooks/endpoints" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"url":"…","events":["*"],"description":"…"}'
```

## Delete an endpoint

```
DELETE /api/v1/webhooks/endpoints/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X DELETE "https://fulkruma.com/api/v1/webhooks/endpoints/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Update an endpoint.

```
PATCH /api/v1/webhooks/endpoints/{id}
```

Update an endpoint. Setting `active: false` pauses it (its queued
deliveries become failed); `active: true` re-enables it — also after
Fulkruma switched it off for failing — and clears its failure streak.
A new `url` goes through the same checks as on register; the signing
secret stays the same.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string (uri) | no | max length 2000 |
| `events` | array of string | no |  |
| `description` | string | no | max length 500 |
| `active` | boolean | no |  |

### Example

```bash
curl -X PATCH "https://fulkruma.com/api/v1/webhooks/endpoints/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"url":"…","events":[],"description":"…","active":false}'
```

## List webhook deliveries.

```
GET /api/v1/webhooks/events
```

List webhook deliveries. Newest first: one row per event per endpoint,
with its status (pending, sent, failed), attempt count, next retry and
every attempt made (`deliveryAttempts`). Filter by `type`, `status` or
`endpointId`; page with `limit` (1-200, default 50) and the returned
`nextCursor`.

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | no | default `50`; min 1; max 200 |
| `cursor` | string | no | min length 1 |
| `type` | string | no | min length 1 |
| `status` | `pending` or `sent` or `failed` | no |  |
| `endpointId` | string | no | min length 1 |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/webhooks/events" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Get a webhook delivery.

```
GET /api/v1/webhooks/events/{id}
```

Get a webhook delivery. Includes every attempt made at it.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/webhooks/events/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Retry a webhook delivery.

```
POST /api/v1/webhooks/events/{id}/retry
```

Retry a webhook delivery. Queues one more attempt now at a failed
delivery (or sends a sent one again). It goes out within a few
seconds; read it back with GET /webhooks/events/:id. 409 when it is
already queued or its endpoint is disabled.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/webhooks/events/:id/retry" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
