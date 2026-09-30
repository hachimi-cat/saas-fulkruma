---
title: Addresses — reference
---

# Addresses

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/addresses` | [List addresses](#list-addresses) |
| `POST` | `/api/v1/addresses` | [Create an address](#create-an-address) |
| `DELETE` | `/api/v1/addresses/{id}` | [Delete an address](#delete-an-address) |
| `PATCH` | `/api/v1/addresses/{id}` | [Update an address](#update-an-address) |

## List addresses

```
GET /api/v1/addresses
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `customer_id` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/addresses" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create an address

```
POST /api/v1/addresses
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | yes | min length 1 |
| `label` | string | yes | min length 1; max length 80 |
| `contactName` | string | yes | min length 1; max length 160 |
| `contactPhone` | string | yes | min length 1; max length 40 |
| `email` | string (email) | no |  |
| `address` | string | yes | min length 1 |
| `note` | string | no |  |
| `postalCode` | string | no |  |
| `areaId` | string | no |  |
| `lat` | number | no |  |
| `lng` | number | no |  |
| `isDefault` | boolean | no |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/addresses" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"…","label":"…","contactName":"…","contactPhone":"…","email":"…","address":"…","note":"…","postalCode":"…","areaId":"…","lat":1,"lng":1,"isDefault":false}'
```

## Delete an address

```
DELETE /api/v1/addresses/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X DELETE "https://fulkruma.com/api/v1/addresses/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Update an address

```
PATCH /api/v1/addresses/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `label` | string | no | min length 1; max length 80 |
| `contactName` | string | no | min length 1; max length 160 |
| `contactPhone` | string | no | min length 1; max length 40 |
| `email` | string (email) | no |  |
| `address` | string | no | min length 1 |
| `note` | string | no |  |
| `postalCode` | string | no |  |
| `areaId` | string | no |  |
| `lat` | number | no |  |
| `lng` | number | no |  |
| `isDefault` | boolean | no |  |

### Example

```bash
curl -X PATCH "https://fulkruma.com/api/v1/addresses/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"label":"…","contactName":"…","contactPhone":"…","email":"…","address":"…","note":"…","postalCode":"…","areaId":"…","lat":1,"lng":1,"isDefault":false}'
```
