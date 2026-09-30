---
title: Stock — reference
---

# Stock

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/stock/adjust` | [Create an adjust](#create-an-adjust) |
| `GET` | `/api/v1/stock/levels` | [List levels](#list-levels) |
| `GET` | `/api/v1/stock/movements` | [List movements](#list-movements) |
| `GET` | `/api/v1/stock/reservations` | [List reservations](#list-reservations) |

## Create an adjust

```
POST /api/v1/stock/adjust
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `variantId` | string | yes | min length 1 |
| `warehouseId` | string | yes | min length 1 |
| `delta` | integer | yes |  |
| `reason` | `manual_adjust` or `initial_stock` or `transfer_in` or `transfer_out` or `damaged` or `returned_to_supplier` or `refund_restock` or `import` | yes |  |
| `note` | string | no |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/stock/adjust" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"variantId":"…","warehouseId":"…","delta":1,"reason":"manual_adjust","note":"…"}'
```

## List levels

```
GET /api/v1/stock/levels
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `variant_id` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/stock/levels" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## List movements

```
GET /api/v1/stock/movements
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `variant_id` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/stock/movements" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## List reservations

```
GET /api/v1/stock/reservations
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/stock/reservations" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
