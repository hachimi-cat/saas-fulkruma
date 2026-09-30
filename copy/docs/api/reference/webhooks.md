---
title: Webhooks — reference
---

# Webhooks

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/webhooks/endpoints` | [List endpoints](#list-endpoints) |
| `POST` | `/api/v1/webhooks/endpoints` | [Create an endpoint](#create-an-endpoint) |
| `DELETE` | `/api/v1/webhooks/endpoints/{id}` | [Delete an endpoint](#delete-an-endpoint) |
| `PATCH` | `/api/v1/webhooks/endpoints/{id}` | [Update an endpoint](#update-an-endpoint) |
| `GET` | `/api/v1/webhooks/events` | [List events](#list-events) |

## List endpoints

```
GET /api/v1/webhooks/endpoints
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/webhooks/endpoints" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create an endpoint

```
POST /api/v1/webhooks/endpoints
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string (uri) | yes |  |
| `events` | array of string | no | default `["*"]` |
| `description` | string | no |  |

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

## Update an endpoint

```
PATCH /api/v1/webhooks/endpoints/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X PATCH "https://fulkruma.com/api/v1/webhooks/endpoints/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## List events

```
GET /api/v1/webhooks/events
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/webhooks/events" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
