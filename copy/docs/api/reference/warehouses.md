---
title: Warehouses — reference
---

# Warehouses

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/warehouses` | [List warehouses](#list-warehouses) |
| `POST` | `/api/v1/warehouses` | [Create a warehouse](#create-a-warehouse) |
| `DELETE` | `/api/v1/warehouses/{id}` | [Delete a warehouse](#delete-a-warehouse) |
| `PATCH` | `/api/v1/warehouses/{id}` | [Update a warehouse](#update-a-warehouse) |

## List warehouses

```
GET /api/v1/warehouses
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/warehouses" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create a warehouse

```
POST /api/v1/warehouses
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | min length 1; max length 120 |
| `address` | string | no | may be null |
| `city` | string | no | may be null |
| `postal` | string | no | may be null |
| `lat` | number | no | may be null |
| `lng` | number | no | may be null |
| `phone` | string | no | may be null |
| `isDefault` | boolean | no |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/warehouses" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"name":"…","address":"…","city":"…","postal":"…","lat":1,"lng":1,"phone":"…","isDefault":false}'
```

## Delete a warehouse

```
DELETE /api/v1/warehouses/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X DELETE "https://fulkruma.com/api/v1/warehouses/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Update a warehouse

```
PATCH /api/v1/warehouses/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | no | min length 1; max length 120 |
| `address` | string | no | may be null |
| `city` | string | no | may be null |
| `postal` | string | no | may be null |
| `lat` | number | no | may be null |
| `lng` | number | no | may be null |
| `phone` | string | no | may be null |
| `isDefault` | boolean | no |  |

### Example

```bash
curl -X PATCH "https://fulkruma.com/api/v1/warehouses/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"name":"…","address":"…","city":"…","postal":"…","lat":1,"lng":1,"phone":"…","isDefault":false}'
```
