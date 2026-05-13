---
title: Addresses
---

# Addresses

A **customer address** is a saved destination address for a buyer &mdash; the address-book row that backs the merchant's checkout autofill and the dashboard's "ship to a saved address" picker. One buyer can have many addresses; one is flagged `isDefault: true`.

This resource is intentionally minimal in v1: list, create, delete. There's no update endpoint &mdash; addresses are append-only, and "editing" is implemented as create + delete. There's no global retrieve-one; list with `?customer_id=` and pick from the result.

All requests on this page must be signed &mdash; see [**Authentication**](/docs/api/authentication).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/addresses` | List addresses (optionally scoped to one customer) |
| `POST` | `/api/v1/addresses` | Save a new address |
| `DELETE` | `/api/v1/addresses/:id` | Delete an address |

### List addresses

```
GET /api/v1/addresses
```

Returns up to 200 addresses in the workspace, default first then by `updatedAt` descending.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `customer_id` | string | Filter to a single customer's addresses. Without it, returns the workspace's full list (used by the merchant dashboard). |

**Response shape**

```json
{
  "data": {
    "addresses": [
      {
        "id": "addr_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "accountId": "acc_01HX...",
        "customerId": "cus_01HX...",
        "label": "Home",
        "contactName": "Alice Tan",
        "contactPhone": "+62811234567",
        "email": "alice@example.com",
        "address": "Jl. Diponegoro 45, Menteng",
        "note": "Ring the bell twice.",
        "postalCode": "10310",
        "areaId": "IDNP6IDNC148IDND1116IDZ12940",
        "lat": -6.1989,
        "lng": 106.8316,
        "isDefault": true,
        "createdAt": "2026-05-12T10:42:00.123Z",
        "updatedAt": "2026-05-12T10:42:00.123Z"
      }
    ]
  },
  "error": null,
  "meta": { ... }
}
```

```bash
fulkruma_curl GET '/api/v1/addresses?customer_id=cus_01HX...'
```

### Save an address

```
POST /api/v1/addresses
```

Saves a new address for a customer. If `isDefault: true` is passed, any existing default for the same customer is demoted in the same transaction.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `customerId` | string | yes | The buyer this address belongs to. |
| `label` | string (1&ndash;80) | yes | Human label (`Home`, `Office`, `Warehouse`). Shown in dashboard pickers. |
| `contactName` | string (1&ndash;160) | yes | Recipient name. Required by Biteship at shipment time. |
| `contactPhone` | string (1&ndash;40) | yes | Recipient phone. Required by Biteship. |
| `address` | string | yes | Street address line. |
| `email` | string | no | Recipient email for tracking-page notifications. |
| `note` | string | no | Delivery instructions. |
| `postalCode` | string | no | Postal code. |
| `areaId` | string | no | Biteship area ID &mdash; look up via [`/api/v1/shipping/areas`](/docs/api/resources/shipping). |
| `lat` | number | no | Latitude. Required at rate-quote time for instant-courier eligibility. |
| `lng` | number | no | Longitude. |
| `isDefault` | boolean | no | Promote this address to the customer's default. Atomically demotes any prior default for the same customer. |

**Response** &mdash; `201 Created`. The created [address object](#the-address-object).

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Missing required field or oversized string. |
| `403` | `NO_ACCOUNT` | Token has no `accountId`. |

```bash
fulkruma_curl POST '/api/v1/addresses' \
  '{"customerId":"cus_01HX...","label":"Home","contactName":"Alice","contactPhone":"+6281...","address":"Jl. Diponegoro 45","isDefault":true}'
```

### Delete an address

```
DELETE /api/v1/addresses/:id
```

Hard-deletes the address. Unlike most Fulkruma resources, addresses are **not** soft-archived &mdash; they're cheap to recreate and reference no historical data. If the address is the customer's default, no other address is auto-promoted; the customer is left with no default until you save the next one.

**Response** &mdash; `200 OK`

```json
{ "data": { "deleted": true }, "error": null, "meta": { ... } }
```

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `404` | `NOT_FOUND` | Address doesn't exist in this workspace. |

## The address object

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | no | Fulkruma ID. Always `addr_` + 26-char ULID. |
| `accountId` | string | no | The workspace. |
| `customerId` | string | no | The buyer this address belongs to. |
| `label` | string | no | Human label. |
| `contactName` | string | no | Recipient name. |
| `contactPhone` | string | no | Recipient phone. |
| `email` | string | yes | Recipient email. |
| `address` | string | no | Street address line. |
| `note` | string | yes | Delivery instructions. |
| `postalCode` | string | yes | Postal code. |
| `areaId` | string | yes | Biteship area ID. |
| `lat` | number | yes | Latitude. |
| `lng` | number | yes | Longitude. |
| `isDefault` | boolean | no | Whether this is the customer's default. |
| `createdAt` | string (ISO 8601 UTC) | no | Creation timestamp. |
| `updatedAt` | string (ISO 8601 UTC) | no | Last mutation timestamp. |

## Events

The addresses resource does **not** emit outbox events. If you need to mirror address changes externally, poll `GET /api/v1/addresses` and reconcile by `updatedAt`.

## Next

- [**Shipping**](/docs/api/resources/shipping) &mdash; quote rates against an address.
- [**Shipments**](/docs/api/resources/shipments) &mdash; ship to an address.
- [**Authentication**](/docs/api/authentication).
