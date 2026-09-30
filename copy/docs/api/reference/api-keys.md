---
title: Api keys — reference
---

# Api keys

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/api-keys` | [List api keys](#list-api-keys) |
| `POST` | `/api/v1/api-keys` | [Create an api key](#create-an-api-key) |
| `POST` | `/api/v1/api-keys/{id}/revoke` | [Revoke an api key](#revoke-an-api-key) |

## List api keys

```
GET /api/v1/api-keys
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/api-keys" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create an api key

```
POST /api/v1/api-keys
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | min length 1; max length 120 |
| `scopes` | array of `read` or `write` or `admin` | no | default `["read","write"]` |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/api-keys" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"name":"…","scopes":["read","write"]}'
```

## Revoke an api key

```
POST /api/v1/api-keys/{id}/revoke
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/api-keys/:id/revoke" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
