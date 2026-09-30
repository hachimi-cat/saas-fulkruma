---
title: Shipments — reference
---

# Shipments

Generated from Fulkruma's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/shipments` | [List shipments](#list-shipments) |
| `POST` | `/api/v1/shipments` | [Create a shipment](#create-a-shipment) |
| `GET` | `/api/v1/shipments/{id}` | [Get a shipment](#get-a-shipment) |
| `POST` | `/api/v1/shipments/{id}/cancel` | [Cancel a booking the courier hasn't collected yet, and give back the shipping credit confirm-pickup consumed.](#cancel-a-booking-the-courier-hasnt-collected-yet-and-give-back-the-shipping-credit-confirm-pickup-consumed) |
| `POST` | `/api/v1/shipments/{id}/confirm-pickup` | [F-004: Merchant clicks "Book courier" once the parcel is actually ready.](#f-004-merchant-clicks-book-courier-once-the-parcel-is-actually-ready) |
| `GET` | `/api/v1/shipments/{id}/label` | [Biteship deliberately has no shipping-label API.](#biteship-deliberately-has-no-shipping-label-api) |
| `POST` | `/api/v1/shipments/{id}/rebook` | [Rebook a shipment](#rebook-a-shipment) |
| `GET` | `/api/v1/shipments/{id}/tracking` | [F-008: live tracking detail (driver, status history, ETA) from Biteship.](#f-008-live-tracking-detail-driver-status-history-eta-from-biteship) |

## List shipments

```
GET /api/v1/shipments
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `status` | any | no |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipments" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Create a shipment

```
POST /api/v1/shipments
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | no |  |
| `checkoutSessionId` | string | no |  |
| `customerId` | string | no |  |
| `customerEmail` | string (email) | no |  |
| `courierCode` | string | yes | min length 1 |
| `courierServiceCode` | string | yes | min length 1 |
| `courierType` | string | yes | min length 1 |
| `price` | integer | yes | min 0 |
| `insurance` | integer | no | min 0 |
| `insured` | boolean | no |  |
| `origin` | object | yes |  |
| `destination` | object | yes |  |
| `items` | array of object | yes |  |
| `externalSource` | string | no | min length 1; max length 50 |
| `externalRef` | string | no | min length 1; max length 255 |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/shipments" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"productId":"…","checkoutSessionId":"…","customerId":"…","customerEmail":"…","courierCode":"…","courierServiceCode":"…","courierType":"…","price":0,"insurance":0,"insured":false,"origin":{},"destination":{},"items":[],"externalSource":"…","externalRef":"…"}'
```

## Get a shipment

```
GET /api/v1/shipments/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipments/:id" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Cancel a booking the courier hasn't collected yet, and give back the shipping credit confirm-pickup consumed.

```
POST /api/v1/shipments/{id}/cancel
```

Cancel a booking the courier hasn't collected yet, and give back the
shipping credit confirm-pickup consumed. All of the behaviour lives in
cancelShipment() so this route and the legacy /shipping/shipments/:id/
cancel one can't drift — see the doc comment there.

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
curl -X POST "https://fulkruma.com/api/v1/shipments/:id/cancel" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"reason":null}'
```

## F-004: Merchant clicks "Book courier" once the parcel is actually ready.

```
POST /api/v1/shipments/{id}/confirm-pickup
```

F-004: Merchant clicks "Book courier" once the parcel is actually
ready. Confirms the Biteship draft, which creates the real order +
dispatches the driver. Returns the updated shipment with the
freshly-allocated biteshipOrderId, waybillId, etc.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://fulkruma.com/api/v1/shipments/:id/confirm-pickup" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Biteship deliberately has no shipping-label API.

```
GET /api/v1/shipments/{id}/label
```

Biteship deliberately has no shipping-label API. Generate the PDF from
Fulkruma's authoritative shipment snapshot so every Forjio product prints
the same document. If an older confirmed row missed the nested
courier.waybill_id response shape, refresh once before declaring it unready.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `size` | `a4` or `thermal-80x100` or `thermal-100x150` | no | default `"thermal-100x150"` |
| `showSenderPhone` | `true` or `false` | no | default `"true"` |
| `showRecipientPhone` | `true` or `false` | no | default `"true"` |
| `maskRecipientName` | `true` or `false` | no | default `"true"` |
| `maskRecipientPhone` | `true` or `false` | no | default `"true"` |
| `showShippingCost` | `true` or `false` | no | default `"true"` |
| `showInsurance` | `true` or `false` | no | default `"true"` |
| `showItems` | `true` or `false` | no | default `"true"` |
| `showItemDescriptions` | `true` or `false` | no | default `"true"` |
| `showItemSkus` | `true` or `false` | no | default `"true"` |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipments/:id/label" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```

## Rebook a shipment

```
POST /api/v1/shipments/{id}/rebook
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
curl -X POST "https://fulkruma.com/api/v1/shipments/:id/rebook" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>" \
  -H "Content-Type: application/json" \
  -d '{"courierCode":"…","courierServiceCode":"…","courierType":"…","price":0,"insured":false,"insurance":0}'
```

## F-008: live tracking detail (driver, status history, ETA) from Biteship.

```
GET /api/v1/shipments/{id}/tracking
```

F-008: live tracking detail (driver, status history, ETA) from Biteship.
Reads biteshipTrackingId off the local shipment then calls
/v1/trackings/:id which returns the richer data including instant-courier
driver info. Used by storlaunch's order detail (merchant + buyer portal).

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://fulkruma.com/api/v1/shipments/:id/tracking" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=<key id>, scope=*, signature=<see /docs/api/authentication>"
```
