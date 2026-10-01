---
title: Deliveries — reference
---

# Deliveries

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/deliveries` | [List deliveries](#list-deliveries) |
| `POST` | `/api/v1/deliveries` | [Create a delivery](#create-a-delivery) |
| `GET` | `/api/v1/deliveries/{id}` | [Get a delivery](#get-a-delivery) |
| `POST` | `/api/v1/deliveries/{id}/download` | [Record a download.](#record-a-download) |
| `POST` | `/api/v1/deliveries/{id}/extend` | [Extend the download window 30 days (from now, or the current expiry).](#extend-the-download-window-30-days-from-now-or-the-current-expiry) |
| `POST` | `/api/v1/deliveries/{id}/reset-downloads` | [Reset the download counter so the buyer can download again.](#reset-the-download-counter-so-the-buyer-can-download-again) |
| `POST` | `/api/v1/deliveries/{id}/revoke` | [Revoke: expire the delivery now.](#revoke-expire-the-delivery-now) |

## List deliveries

```
GET /api/v1/deliveries
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/deliveries" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create a delivery

```
POST /api/v1/deliveries
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes | min length 1 |
| `customerId` | string | yes | min length 1 |
| `checkoutSessionId` | string | yes | min length 1 |
| `maxDownloads` | integer | no | above 0; max 100 |
| `expiresAt` | string (date-time) | no |  |
| `externalSource` | string | no | min length 1; max length 50 |
| `externalRef` | string | no | min length 1; max length 255 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/deliveries" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"productId":"…","customerId":"…","checkoutSessionId":"…","maxDownloads":1,"expiresAt":"2026-01-01T00:00:00Z","externalSource":"…","externalRef":"…"}'
```

## Get a delivery

```
GET /api/v1/deliveries/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/deliveries/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Record a download.

```
POST /api/v1/deliveries/{id}/download
```

Record a download. Call it from the endpoint that serves the file, before serving it:
it counts the download against `maxDownloads` (atomically: two at once can't both take
the last one) and emits fulkruma.delivery.downloaded.v1. 410 EXPIRED when the delivery
has expired (or was revoked), 409 DOWNLOAD_LIMIT when every download is used — serve
nothing then.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/deliveries/:id/download" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Extend the download window 30 days (from now, or the current expiry).

```
POST /api/v1/deliveries/{id}/extend
```

Extend the download window 30 days (from now, or the current expiry). A delivery that
had expired is live again, so its next expiry is announced again.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/deliveries/:id/extend" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Reset the download counter so the buyer can download again.

```
POST /api/v1/deliveries/{id}/reset-downloads
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/deliveries/:id/reset-downloads" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Revoke: expire the delivery now.

```
POST /api/v1/deliveries/{id}/revoke
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/deliveries/:id/revoke" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
