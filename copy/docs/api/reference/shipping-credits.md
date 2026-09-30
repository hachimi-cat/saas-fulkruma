---
title: Shipping credits — reference
---

# Shipping credits

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/shipping-credits` | [Balance for the calling merchant.](#balance-for-the-calling-merchant) |
| `POST` | `/api/v1/shipping-credits/adjust` | [Create an adjust](#create-an-adjust) |
| `POST` | `/api/v1/shipping-credits/checkout` | [Create a checkout](#create-a-checkout) |
| `POST` | `/api/v1/shipping-credits/topup` | [Create a topup](#create-a-topup) |
| `GET` | `/api/v1/shipping-credits/transactions` | [List transactions](#list-transactions) |

## Balance for the calling merchant.

```
GET /api/v1/shipping-credits
```

GET /shipping-credits — balance for the calling merchant.

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping-credits" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create an adjust

```
POST /api/v1/shipping-credits/adjust
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | integer | yes |  |
| `kind` | `manual_adjustment` or `shipment_refund` | yes |  |
| `shipmentId` | string | no |  |
| `externalRef` | string | no |  |
| `memo` | string | no | max length 500 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/shipping-credits/adjust" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"amount":1,"kind":"manual_adjustment","shipmentId":"…","externalRef":"…","memo":"…"}'
```

## Create a checkout

```
POST /api/v1/shipping-credits/checkout
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | integer | yes | min 10000; max 10000000 |
| `email` | string (email) | no |  |
| `name` | string | no | min length 1; max length 120 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/shipping-credits/checkout" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"amount":10000,"email":"…","name":"…"}'
```

## Create a topup

```
POST /api/v1/shipping-credits/topup
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | integer | yes | above 0 |
| `externalRef` | string | no | min length 1; max length 255 |
| `memo` | string | no | max length 500 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/shipping-credits/topup" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"amount":1,"externalRef":"…","memo":"…"}'
```

## List transactions

```
GET /api/v1/shipping-credits/transactions
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | no | min 1; max 200 |
| `cursor` | string | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping-credits/transactions" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
