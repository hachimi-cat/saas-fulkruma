---
title: Shipping
---

# Shipping

The **shipping** resource is the orchestration layer between merchants, the Biteship aggregator, and Fulkruma's local shipment objects. It owns:

- The merchant's **shipping origin** (separate from warehouse addresses &mdash; the address Biteship gives to drivers).
- The **courier catalog** &mdash; the live list of couriers and services Biteship supports.
- **Rate quotes** &mdash; ask Biteship for prices and ETAs for a given destination + items combination.
- **Area search** for postal-code lookup at checkout.
- The **Biteship config** &mdash; the merchant's own Biteship API key (BYO) plus default-courier settings.

For the shipment objects themselves (status, events, label, cancel, tracking), see [**Shipments**](/docs/api/resources/shipments).

All requests on this page must be signed &mdash; see [**Authentication**](/docs/api/authentication).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/shipping/origin` | Read the merchant's shipping origin |
| `PATCH` | `/api/v1/shipping/origin` | Set or update the shipping origin |
| `GET` | `/api/v1/shipping/couriers` | List the live Biteship courier catalog |
| `GET` | `/api/v1/shipping/areas?q=...` | Search Biteship areas (postal-code lookup) |
| `POST` | `/api/v1/shipping/rates` | Quote rates for a destination + items |
| `GET` | `/api/v1/shipping/config` | Read the merchant's Biteship config |
| `PUT` | `/api/v1/shipping/config` | Update the Biteship config |

### Read shipping origin

```
GET /api/v1/shipping/origin
```

Returns the merchant's configured shipping origin. If unconfigured, returns an envelope with all fields `null` and `configured: false`:

```json
{
  "data": {
    "address": "Jl. Sudirman 123",
    "province": "DKI Jakarta",
    "city": "Jakarta Pusat",
    "district": "Setiabudi",
    "village": "Karet Tengsin",
    "postal": "10220",
    "areaId": "IDNP6IDNC148IDND1116IDZ12940",
    "lat": -6.2088,
    "lng": 106.8456,
    "note": "Ring the bell twice.",
    "contactName": "Warehouse",
    "contactPhone": "+628111111111",
    "couriers": ["jne", "sicepat", "anteraja", "jnt", "gojek", "grab"],
    "configured": true
  },
  "error": null,
  "meta": { ... }
}
```

### Update shipping origin

```
PATCH /api/v1/shipping/origin
```

Sets or updates the origin in one call (upserts; create-or-replace semantics on the underlying `BiteshipConfig` row). Updating the address invalidates the cached Biteship "Location" mirror &mdash; the next outbound shipment recreates it lazily.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | string (1&ndash;500) | yes | Street address line. |
| `contactName` | string (1&ndash;100) | yes | Pickup contact name. |
| `contactPhone` | string (1&ndash;30) | yes | Pickup contact phone. |
| `province` | string | no | Province name (free-form; Biteship matches loosely). |
| `city` | string | no | City. |
| `district` | string | no | Kecamatan. |
| `village` | string | no | Kelurahan. |
| `postal` | string (&le;20) | no | Postal code. |
| `areaId` | string | no | Biteship area ID &mdash; look up via `/api/v1/shipping/areas`. Required for rate-quote accuracy in some regions. |
| `lat` | number | no | Latitude. **Required** if `couriers` includes any instant-delivery code (`gojek`, `grab`, etc.). |
| `lng` | number | no | Longitude. **Required** if `couriers` includes any instant-delivery code. |
| `note` | string | no | Free-form note for the driver. |
| `couriers` | string[] | no | Enabled courier codes for this merchant. Validated against the live Biteship catalog with a 1-hour cache &mdash; passing an unknown code returns `400 VALIDATION_ERROR`. |

<blockquote class="callout-warn">

**Instant couriers require coords.** Codes whose every service tier is `instant` or `same_day` (e.g. `gojek`, `grab`) reject orders without origin lat/lng. PATCHing the origin with such a code but no coords returns `400 VALIDATION_ERROR: Instant couriers require origin lat/lng`.

</blockquote>

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing required field, unknown courier code, or instant courier without coords. |
| `403` | `NO_ACCOUNT` | Token has no `accountId`. |

```bash
fulkruma_curl PATCH '/api/v1/shipping/origin' \
  '{"address":"Jl. Sudirman 123","city":"Jakarta","postal":"10220","contactName":"Warehouse","contactPhone":"+62811111111","couriers":["jne","sicepat"]}'
```

### List couriers

```
GET /api/v1/shipping/couriers
```

Returns the live Biteship courier catalog. Each row is one courier + service-tier combination; the same courier code can appear multiple times across `service_type` values (`standard`, `same_day`, `instant`, etc.).

```json
{
  "data": [
    { "courier_code": "jne", "courier_name": "JNE", "courier_service_code": "reg", "courier_service_name": "Regular", "service_type": "standard", "tier": "regular" },
    { "courier_code": "gojek", "courier_name": "Gojek", "courier_service_code": "instant", "courier_service_name": "Instant", "service_type": "instant", "tier": "regular" }
  ],
  "error": null,
  "meta": { ... }
}
```

### Search areas

```
GET /api/v1/shipping/areas?q=...
```

Searches Biteship's area catalog by free-form query (`q` &ge; 2 chars). Returns up to ~10 hits per query. Use the `id` from this response as the `areaId` on origin/destination addresses for the most accurate rate quotes.

```json
{
  "data": [
    {
      "id": "IDNP6IDNC148IDND1116IDZ12940",
      "name": "Karet Tengsin, Setiabudi, Jakarta Pusat, DKI Jakarta",
      "country_name": "Indonesia",
      "administrative_division_level_1_name": "DKI Jakarta",
      "administrative_division_level_2_name": "Jakarta Pusat",
      "administrative_division_level_3_name": "Setiabudi",
      "administrative_division_level_4_name": "Karet Tengsin",
      "postal_code": 10220
    }
  ],
  "error": null,
  "meta": { ... }
}
```

### Rate quote

```
POST /api/v1/shipping/rates
```

Quotes courier rates for the given destination + items combination, using the merchant's configured shipping origin and enabled couriers.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `destination` | object | yes | See [the destination shape](#the-destination-shape). |
| `items` | array | yes | At least one item. See [the item shape](#the-item-shape). |
| `insurance` | boolean | no | Include insured pricing tiers in the response. |

**Response** &mdash; `200 OK`

```json
{
  "data": {
    "rates": [
      {
        "courierCode": "jne",
        "courierName": "JNE",
        "courierServiceCode": "reg",
        "courierServiceName": "Regular",
        "courierType": "standard",
        "price": 18000,
        "etaMin": 2,
        "etaMax": 4,
        "etaUnit": "days",
        "insurance": 0
      }
    ],
    "count": 6,
    "hasCoords": true
  },
  "error": null,
  "meta": { ... }
}
```

If `destination.lat`/`lng` are absent, instant-courier rates are silently filtered out and `hasCoords` is `false`. The merchant's dashboard uses this flag to nudge the buyer to add precise coords.

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing required field. |
| `400` | `NOT_CONFIGURED` | Merchant has not configured the shipping origin yet. |

### The destination shape

| Field | Type | Required | Description |
|---|---|---|---|
| `contactName` | string (1&ndash;100) | yes | Recipient name. |
| `contactPhone` | string (1&ndash;30) | yes | Recipient phone. Used by drivers. |
| `email` | string | no | Recipient email for tracking-page notifications. |
| `address` | string (1&ndash;500) | yes | Street address line. |
| `note` | string | no | Delivery instructions. |
| `postalCode` | string | no | Postal code. |
| `areaId` | string | no | Biteship area ID. Use `/shipping/areas?q=…` to find. |
| `lat` | number | no | Latitude. Required for instant couriers to appear in quotes. |
| `lng` | number | no | Longitude. |

### The item shape

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string (1&ndash;200) | yes | Item name (appears on courier manifest). |
| `value` | integer (&ge;0) | yes | Item value in IDR cents. Used for insurance and customs. |
| `weight` | integer (&ge;1) | yes | Weight in grams. |
| `quantity` | integer (&ge;1) | yes | Number of units. |
| `description` | string | no | Free-form description. |
| `category` | string | no | Biteship item category (e.g. `food`, `electronics`). |
| `length` | integer | no | Centimetres. |
| `width` | integer | no | Centimetres. |
| `height` | integer | no | Centimetres. |
| `productId` | string | no | Linked Fulkruma product. |

### Biteship config

```
GET /api/v1/shipping/config
PUT /api/v1/shipping/config
```

The Biteship config sits beside the shipping origin on the same `BiteshipConfig` row. The endpoints split write surface for clarity:

- `/shipping/origin` &mdash; address, contact, enabled couriers.
- `/shipping/config` &mdash; API key (BYO Biteship), `defaultOriginId`, `defaultCourier`, `active` flag.

**Request body (`PUT /config`)**

| Field | Type | Description |
|---|---|---|
| `apiKey` | string \| null | BYO Biteship API key. Pass `null` to remove and fall back to Fulkruma's platform key. Stored encrypted; only the last 4 chars are returned on read. |
| `defaultOriginId` | string \| null | Biteship Location ID to use as origin (override the address-based mirror). |
| `enabledCouriers` | string[] | Override the courier whitelist. |
| `defaultCourier` | string \| null | Pre-selected courier at checkout. |
| `active` | boolean | Master kill-switch for the shipping integration. |

```json
{
  "data": {
    "config": {
      "accountId": "acc_01HX...",
      "apiKeyConfigured": true,
      "apiKeyPreview": "…ab12",
      "defaultOriginId": null,
      "enabledCouriers": ["jne", "sicepat"],
      "defaultCourier": "jne",
      "active": true
    },
    "couriers": ["jne", "sicepat", "anteraja", "jnt", "gojek", "grab"]
  },
  "error": null,
  "meta": { ... }
}
```

## Events

The shipping resource itself does not emit dedicated events. Lifecycle events fire under the [shipments](/docs/api/resources/shipments#events) resource.

See [**Webhooks**](/docs/api/resources/webhooks) for the envelope and signature recipe.

## Pattern 2: partner-managed shipping

When a Forjio partner (Storlaunch, Ripllo) calls Fulkruma on behalf of a merchant, the partner passes `X-Fulkruma-On-Behalf-Of: acc_<merchantId>` &mdash; all of the above endpoints then operate on that merchant's `BiteshipConfig`. The partner cannot read or set the merchant's encrypted Biteship API key via the API (returns `apiKeyConfigured` only); only the merchant can rotate it from their dashboard.

## Next

- [**Shipments**](/docs/api/resources/shipments) &mdash; the shipment objects produced by this layer.
- [**Addresses**](/docs/api/resources/addresses) &mdash; saved destination addresses.
- [**Authentication**](/docs/api/authentication) &mdash; HMAC signing.
