---
title: Shipping — reference
---

# Shipping

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/shipping/areas` | [List areas](#list-areas) |
| `GET` | `/api/v1/shipping/config` | [List config](#list-config) |
| `PUT` | `/api/v1/shipping/config` | [Set config](#set-config) |
| `GET` | `/api/v1/shipping/couriers` | [In Fulkruma we still gate this behind requireAuth: the dashboard always has a session, and we want per-merchant API key resolution.](#in-fulkruma-we-still-gate-this-behind-requireauth-the-dashboard-always-has-a-session-and-we-want-per-merchant-api-key-resolution) |
| `GET` | `/api/v1/shipping/origin` | [List origin](#list-origin) |
| `PATCH` | `/api/v1/shipping/origin` | [Update origin](#update-origin) |
| `POST` | `/api/v1/shipping/rates` | [Create a rate](#create-a-rate) |
| `GET` | `/api/v1/shipping/shipments` | [List shipments](#list-shipments) |
| `GET` | `/api/v1/shipping/shipments/{id}` | [Get a shipment](#get-a-shipment) |
| `POST` | `/api/v1/shipping/shipments/{id}/cancel` | [Legacy namespace.](#legacy-namespace) |
| `GET` | `/api/v1/shipping/shipments/{id}/label` | [Legacy shipping namespace.](#legacy-shipping-namespace) |
| `POST` | `/api/v1/shipping/shipments/{id}/rebook` | [Legacy-namespace twin of /shipments/:id/rebook.](#legacy-namespace-twin-of-shipmentsidrebook) |
| `GET` | `/api/v1/shipping/track/{waybillId}` | [─── GET /shipping/track/:waybillId (public — gated by requireAuth in Fulkruma) ─](#get-shippingtrackwaybillid-public-gated-by-requireauth-in-fulkruma) |

## List areas

```
GET /api/v1/shipping/areas
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `q` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping/areas" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## List config

```
GET /api/v1/shipping/config
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping/config" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Set config

```
PUT /api/v1/shipping/config
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `apiKey` | string | no | may be null |
| `defaultOriginId` | string | no | may be null |
| `enabledCouriers` | array of string | no |  |
| `defaultCourier` | string | no | may be null |
| `active` | boolean | no |  |

### Example

```bash
curl -X PUT "https://fulkruma.com/api/v1/shipping/config" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"…","defaultOriginId":"…","enabledCouriers":[],"defaultCourier":"…","active":false}'
```

## In Fulkruma we still gate this behind requireAuth: the dashboard always has a session, and we want per-merchant API key resolution.

```
GET /api/v1/shipping/couriers
```

In Fulkruma we still gate this behind requireAuth: the dashboard always
has a session, and we want per-merchant API key resolution.

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping/couriers" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## List origin

```
GET /api/v1/shipping/origin
```

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping/origin" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Update origin

```
PATCH /api/v1/shipping/origin
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `address` | string | yes | min length 1; max length 500 |
| `province` | string | no | max length 100; may be null |
| `city` | string | no | max length 100; may be null |
| `district` | string | no | max length 100; may be null |
| `village` | string | no | max length 100; may be null |
| `postal` | string | no | max length 20; may be null |
| `areaId` | string | no | max length 100; may be null |
| `lat` | number | no | may be null |
| `lng` | number | no | may be null |
| `note` | string | no | max length 500; may be null |
| `contactName` | string | yes | min length 1; max length 100 |
| `contactPhone` | string | yes | min length 1; max length 30 |
| `couriers` | array of string | no |  |

### Example

```bash
curl -X PATCH "https://fulkruma.com/api/v1/shipping/origin" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"address":"…","province":"…","city":"…","district":"…","village":"…","postal":"…","areaId":"…","lat":1,"lng":1,"note":"…","contactName":"…","contactPhone":"…","couriers":[]}'
```

## Create a rate

```
POST /api/v1/shipping/rates
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `destination` | object | yes |  |
| `items` | array of object | yes |  |
| `insurance` | boolean | no |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/shipping/rates" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"destination":{"contactName":"…","contactPhone":"…","address":"…"},"items":[],"insurance":false}'
```

## List shipments

```
GET /api/v1/shipping/shipments
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `cursor` | any | no |  |
| `limit` | any | no |  |
| `status` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping/shipments" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Get a shipment

```
GET /api/v1/shipping/shipments/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping/shipments/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Legacy namespace.

```
POST /api/v1/shipping/shipments/{id}/cancel
```

Legacy namespace. Same cancelShipment() call as /shipments/:id/cancel,
so both paths refund the shipping credit and emit the same events.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `reason` | any | no |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/shipping/shipments/:id/cancel" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"reason":null}'
```

## Legacy shipping namespace.

```
GET /api/v1/shipping/shipments/{id}/label
```

Legacy shipping namespace. Keep it functional, but generate the same
Fulkruma-owned PDF as the canonical /shipments/:id/label route.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `size` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping/shipments/:id/label" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Legacy-namespace twin of /shipments/:id/rebook.

```
POST /api/v1/shipping/shipments/{id}/rebook
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `courierCode` | string | no | min length 1 |
| `courierServiceCode` | string | no | min length 1 |
| `courierType` | string | no | min length 1 |
| `price` | integer | no | min 0 |
| `insured` | boolean | no |  |
| `insurance` | integer | no | min 0 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/shipping/shipments/:id/rebook" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"courierCode":"…","courierServiceCode":"…","courierType":"…","price":0,"insured":false,"insurance":0}'
```

## ─── GET /shipping/track/:waybillId (public — gated by requireAuth in Fulkruma) ─

```
GET /api/v1/shipping/track/{waybillId}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `waybillId` | string | yes |  |

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `courier` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipping/track/:waybillId" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
