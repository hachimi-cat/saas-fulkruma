---
title: Billing — reference
---

# Billing

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/billing/cancel` | [Create a cancel](#create-a-cancel) |
| `POST` | `/api/v1/billing/checkout` | [Create a checkout](#create-a-checkout) |
| `GET` | `/api/v1/billing/invoices` | [List invoices](#list-invoices) |
| `GET` | `/api/v1/billing/plan` | [List plan](#list-plan) |
| `GET` | `/api/v1/billing/plans` | [Public, no auth.](#public-no-auth) |
| `GET` | `/api/v1/billing/subscription` | [List subscription](#list-subscription) |
| `GET` | `/api/v1/billing/usage` | [List usage](#list-usage) |

## Create a cancel

```
POST /api/v1/billing/cancel
```

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/billing/cancel" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create a checkout

```
POST /api/v1/billing/checkout
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `plan` | `STARTER` or `GROWTH` or `SCALE` | yes |  |
| `email` | string (email) | no |  |
| `name` | string | no |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/billing/checkout" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"plan":"STARTER","email":"…","name":"…"}'
```

## List invoices

```
GET /api/v1/billing/invoices
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `cursor` | any | no |  |
| `limit` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/billing/invoices" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## List plan

```
GET /api/v1/billing/plan
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/billing/plan" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Public, no auth.

```
GET /api/v1/billing/plans
```

GET /billing/plans — public, no auth. Powers the landing-page Pricing
section + the /dashboard/billing plan picker.

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/billing/plans" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## List subscription

```
GET /api/v1/billing/subscription
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/billing/subscription" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## List usage

```
GET /api/v1/billing/usage
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/billing/usage" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
