---
title: Licenses — reference
---

# Licenses

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/licenses` | [List licenses](#list-licenses) |
| `POST` | `/api/v1/licenses` | [Create a license](#create-a-license) |
| `POST` | `/api/v1/licenses/{id}/revoke` | [Revoke a license](#revoke-a-license) |
| `POST` | `/api/v1/licenses/activate` | [/v1/licenses/activate is unauthenticated — buyers' apps call this with the license key directly.](#v1licensesactivate-is-unauthenticated-buyers-apps-call-this-with-the-license-key-directly) |
| `POST` | `/api/v1/licenses/deactivate` | [Release a previously-activated instance.](#release-a-previously-activated-instance) |
| `GET` | `/api/v1/licenses/lookup` | [Full license + its activation rows, resolved by key within the merchant's account.](#full-license-its-activation-rows-resolved-by-key-within-the-merchants-account) |
| `GET` | `/api/v1/licenses/validate` | [Public unauthenticated endpoints — buyers' software calls these with just the license key.](#public-unauthenticated-endpoints-buyers-software-calls-these-with-just-the-license-key) |

## List licenses

```
GET /api/v1/licenses
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/licenses" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create a license

```
POST /api/v1/licenses
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes | min length 1 |
| `customerId` | string | yes | min length 1 |
| `maxActivations` | integer | no | above 0 |
| `expiresAt` | string (date-time) | no |  |
| `externalSource` | string | no | min length 1; max length 50 |
| `externalRef` | string | no | min length 1; max length 255 |
| `key` | string | no | min length 8; max length 120 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/licenses" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"productId":"…","customerId":"…","maxActivations":1,"expiresAt":"2026-01-01T00:00:00Z","externalSource":"…","externalRef":"…","key":"…"}'
```

## Revoke a license

```
POST /api/v1/licenses/{id}/revoke
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/licenses/:id/revoke" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## /v1/licenses/activate is unauthenticated — buyers' apps call this with the license key directly.

```
POST /api/v1/licenses/activate
```

/v1/licenses/activate is unauthenticated — buyers' apps call this
with the license key directly. Mount BEFORE requireAuth.

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | min length 8 |
| `instanceId` | string | yes | min length 1 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/licenses/activate" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"key":"…","instanceId":"…"}'
```

## Release a previously-activated instance.

```
POST /api/v1/licenses/deactivate
```

POST /licenses/deactivate — release a previously-activated instance.
Buyers' apps call this when uninstalling. Idempotent on repeat calls.

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | min length 8 |
| `instanceId` | string | yes | min length 1 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/licenses/deactivate" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"key":"…","instanceId":"…"}'
```

## Full license + its activation rows, resolved by key within the merchant's account.

```
GET /api/v1/licenses/lookup
```

GET /licenses/lookup?key=<key> — full license + its activation rows,
resolved by key within the merchant's account. Backs partner order-
detail UIs (e.g. Storlaunch's License panel): they hold the key and
need the license id (for revoke) plus the per-device activation list
that `validate` (counts only) doesn't carry.

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | min length 1 |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/licenses/lookup" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Public unauthenticated endpoints — buyers' software calls these with just the license key.

```
GET /api/v1/licenses/validate
```

Public unauthenticated endpoints — buyers' software calls these with
just the license key. Mount BEFORE requireAuth.
GET /licenses/validate?key=<key>&productId=<optional>
  Returns `{ valid, status, productId, productName, activations,
            maxActivations, expiresAt }`. Never errors on bad keys —
  just returns valid:false. Used by license-protected software to
  check whether a key is still good.

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | min length 1 |
| `productId` | string | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/licenses/validate" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
