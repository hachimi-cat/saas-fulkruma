---
title: Products — reference
---

# Products

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/products` | [List products](#list-products) |
| `POST` | `/api/v1/products` | [Create a product](#create-a-product) |
| `DELETE` | `/api/v1/products/{id}` | [Delete a product](#delete-a-product) |
| `GET` | `/api/v1/products/{id}` | [Get a product](#get-a-product) |
| `PATCH` | `/api/v1/products/{id}` | [Update a product](#update-a-product) |
| `POST` | `/api/v1/products/{id}/variants` | [Variants a product](#variants-a-product) |
| `DELETE` | `/api/v1/products/{id}/variants/{variantId}` | [Delete a variant](#delete-a-variant) |
| `PATCH` | `/api/v1/products/{id}/variants/{variantId}` | [Update a variant](#update-a-variant) |

## List products

```
GET /api/v1/products
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `archived` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/products" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create a product

```
POST /api/v1/products
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | min length 1; max length 200 |
| `sku` | string | no |  |
| `description` | string | no |  |
| `type` | `physical` or `digital` or `license` | no | default `"physical"` |
| `weight` | integer | no | min 0 |
| `length` | integer | no | min 0 |
| `width` | integer | no | min 0 |
| `height` | integer | no | min 0 |
| `licenseEnabled` | boolean | no |  |
| `maxActivations` | integer | no | above 0 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/products" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"name":"…","sku":"…","description":"…","type":"physical","weight":0,"length":0,"width":0,"height":0,"licenseEnabled":false,"maxActivations":0}'
```

## Delete a product

```
DELETE /api/v1/products/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X DELETE "https://fulkruma.com/api/v1/products/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Get a product

```
GET /api/v1/products/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/products/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Update a product

```
PATCH /api/v1/products/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | no | min length 1; max length 200 |
| `sku` | string | no |  |
| `description` | string | no |  |
| `type` | `physical` or `digital` or `license` | no | default `"physical"` |
| `weight` | integer | no | min 0 |
| `length` | integer | no | min 0 |
| `width` | integer | no | min 0 |
| `height` | integer | no | min 0 |
| `licenseEnabled` | boolean | no |  |
| `maxActivations` | integer | no | above 0 |

### Example

```bash
curl -X PATCH "https://fulkruma.com/api/v1/products/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"name":"…","sku":"…","description":"…","type":"physical","weight":0,"length":0,"width":0,"height":0,"licenseEnabled":false,"maxActivations":0}'
```

## Variants a product

```
POST /api/v1/products/{id}/variants
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `sku` | string | no |  |
| `name` | string | yes | min length 1; max length 160 |
| `priceCents` | integer | no | min 0 |
| `costCents` | integer | no | min 0 |
| `lowStockThreshold` | integer | no | min 0 |
| `weight` | integer | no | min 0 |
| `isDefault` | boolean | no |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/products/:id/variants" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"sku":"…","name":"…","priceCents":0,"costCents":0,"lowStockThreshold":0,"weight":0,"isDefault":false}'
```

## Delete a variant

```
DELETE /api/v1/products/{id}/variants/{variantId}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `variantId` | string | yes |  |

### Example

```bash
curl -X DELETE "https://fulkruma.com/api/v1/products/:id/variants/:variantId" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Update a variant

```
PATCH /api/v1/products/{id}/variants/{variantId}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `variantId` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `sku` | string | no |  |
| `name` | string | no | min length 1; max length 160 |
| `priceCents` | integer | no | min 0 |
| `costCents` | integer | no | min 0 |
| `lowStockThreshold` | integer | no | min 0 |
| `weight` | integer | no | min 0 |
| `isDefault` | boolean | no |  |

### Example

```bash
curl -X PATCH "https://fulkruma.com/api/v1/products/:id/variants/:variantId" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"sku":"…","name":"…","priceCents":0,"costCents":0,"lowStockThreshold":0,"weight":0,"isDefault":false}'
```
