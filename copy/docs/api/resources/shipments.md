---
title: Shipments
---

# Shipments

A **shipment** is a physical order routed through a courier &mdash; Biteship in v1, with adapters for additional aggregators planned. Each shipment represents one parcel: an origin warehouse, a destination address, the items inside it, the courier service chosen, and the status that walks the parcel from `pending` to `delivered`.

Shipments are the load-bearing fulfilment object: every `physical`-type [product](/docs/api/resources/products) goes through one to reach the buyer. They consume [stock reservations](/docs/api/resources/stock) on creation and trigger stock movements on dispatch.

All requests on this page must be signed &mdash; see [**Authentication**](/docs/api/authentication).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/shipments` | List shipments (no pagination) |
| `GET` | `/api/v1/shipments/:id` | Retrieve one shipment with its event log |
| `POST` | `/api/v1/shipments` | Create a shipment |
| `GET` | `/api/v1/shipping/shipments` | Cursor-paginated list (preferred) |
| `GET` | `/api/v1/shipping/shipments/:id/label` | Fetch the courier-generated label PDF URL |
| `POST` | `/api/v1/shipping/shipments/:id/cancel` | Cancel a shipment before pickup |
| `GET` | `/api/v1/shipping/track/:waybillId` | Public tracking page lookup |

The `/shipments` and `/shipping/shipments` paths overlap deliberately: `/shipments` is the legacy CRUD surface kept for SDK compatibility; `/shipping/shipments` is the newer cursor-paginated endpoint with richer filters. New integrations should prefer the `/shipping/*` path.

### List shipments (cursor-paginated)

```
GET /api/v1/shipping/shipments
```

Returns shipments newest first, cursor-paginated. Filter by `status` to scope to a single lifecycle bucket.

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | `25` | Page size. Clamped to `[1, 100]`. |
| `cursor` | string | &mdash; | The previous page's `meta.cursor`. |
| `status` | string | &mdash; | Exact status filter. See [statuses](#status-lifecycle). |

**Response** &mdash; `200 OK`

The envelope uses an array `data` and a `meta.cursor`:

```json
{
  "data": [
    {
      "id": "ship_01HXAB7K3M9N2P5QRS8TVWXY3Z",
      "accountId": "acc_01HX...",
      "status": "in_transit",
      "courierCode": "jne",
      "courierServiceCode": "reg",
      "courierType": "standard",
      "price": 18000,
      "insurance": 0,
      "insured": false,
      "biteshipOrderId": "ord_jbk_xxx",
      "waybillId": "JNE1234567890",
      "labelUrl": "https://...",
      "customerEmail": "buyer@example.com",
      "checkoutSessionId": "cs_01HX...",
      "createdAt": "2026-05-12T10:42:00.123Z",
      "updatedAt": "2026-05-12T11:01:00.123Z"
    }
  ],
  "error": null,
  "meta": {
    "requestId": "req_01HX...",
    "timestamp": "2026-05-12T10:42:00.124Z",
    "total": 137,
    "cursor": "ship_01HX...",
    "hasMore": true
  }
}
```

```js
// Node
let cursor;
do {
  const { data, meta } = await fk.shipping.shipments.list({ limit: 100, cursor });
  for (const s of data) handle(s);
  cursor = meta.cursor;
} while (cursor);
```

```bash
fulkruma_curl GET '/api/v1/shipping/shipments?limit=50&status=in_transit'
```

### Retrieve a shipment

```
GET /api/v1/shipping/shipments/:id
```

Returns the shipment with its `events` array inlined &mdash; the timeline of provider-side status updates received via the inbound Biteship webhook.

**Response shape** (events truncated):

```json
{
  "data": {
    "id": "ship_01HX...",
    "status": "delivered",
    "events": [
      { "id": "evt_01HX...", "status": "delivered", "note": "Received by recipient", "occurredAt": "2026-05-13T08:14:00Z" },
      { "id": "evt_01HX...", "status": "in_transit", "note": "Out for delivery", "occurredAt": "2026-05-13T05:00:00Z" }
    ]
  },
  "error": null,
  "meta": { ... }
}
```

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `404` | `NOT_FOUND` | Shipment doesn't exist in this workspace. |

### Create a shipment

```
POST /api/v1/shipments
```

Creates a shipment in the calling workspace and emits a [`fulkruma.shipment.created.v1`](/docs/api/webhooks/events/fulkruma.shipment.created) event.

<blockquote class="callout-warn">

**Phase E stub.** Today `POST /shipments` records the intent locally with a placeholder `biteshipOrderId` (prefixed `pending-`) but does **not** create a real Biteship order. The full Biteship adapter ships in Phase F as part of the Storlaunch integration. Use [`/api/v1/shipping/rates`](/docs/api/resources/shipping#rate-quote) for live quoting today.

</blockquote>

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `courierCode` | string | yes | Biteship courier code, e.g. `jne`, `sicepat`, `gosend`. Validate with `/api/v1/shipping/couriers`. |
| `courierServiceCode` | string | yes | Service tier within the courier, e.g. `reg`, `yes`, `same_day`. |
| `courierType` | string | yes | `standard`, `same_day`, or `instant`. |
| `price` | integer (&ge;0) | yes | Quoted price in IDR cents. Source from a rate quote. |
| `origin` | object | yes | Origin snapshot. Either populate from your warehouse or take the merchant's configured shipping origin. |
| `destination` | object | yes | Destination address. See [the destination shape](/docs/api/resources/shipping#the-destination-shape). |
| `items` | array | yes | At least one item. Each carries `name`, `value`, `weight`, `quantity`, plus optional dimensional fields. |
| `insurance` | integer | no | Insurance premium in cents, if quoted. |
| `insured` | boolean | no | Whether insurance was elected. |
| `productId` | string | no | Link the shipment to a Fulkruma product. |
| `checkoutSessionId` | string | no | The Plugipay checkout session that originated this order. |
| `customerId` | string | no | The Fulkruma-tracked buyer ID. |
| `customerEmail` | string | no | Buyer email (used for tracking-page notifications). |
| `externalSource` | string | no | Where the order originated (`storlaunch`, your storefront name, etc.). |
| `externalRef` | string | no | The originating system's order ID. |

**Response** &mdash; `201 Created`. The created [shipment object](#the-shipment-object).

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Missing required field, bad shape, or unknown courier code. |
| `403` | `NO_ACCOUNT` | Token authenticated but has no `accountId` claim. |

```bash
fulkruma_curl POST '/api/v1/shipments' \
  '{
    "courierCode":"jne","courierServiceCode":"reg","courierType":"standard","price":18000,
    "origin":{"contactName":"Warehouse","contactPhone":"+62811111111","address":"Jakarta 10220"},
    "destination":{"contactName":"Alice","contactPhone":"+62822222222","address":"Bandung 40115"},
    "items":[{"name":"Coffee 250g","value":85000,"weight":280,"quantity":1}]
  }'
```

### Cancel a shipment

```
POST /api/v1/shipping/shipments/:id/cancel
```

Cancels the shipment with the courier (best-effort &mdash; some couriers refuse cancel after pickup) and transitions Fulkruma's row to `cancelled`. Reservations are released; consumed stock is restocked via a `refund_restock` movement.

**Request body**

| Field | Type | Description |
|---|---|---|
| `reason` | string | Optional reason. Defaults to `"Merchant cancelled"`. |

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `404` | `NOT_FOUND` | Shipment not in this workspace. |
| `409` | `INVALID_STATE` | Shipment is already `delivered`, `cancelled`, or post-pickup with a courier that rejects cancellations. |

### Fetch the shipping label

```
GET /api/v1/shipping/shipments/:id/label
```

Returns the URL of the courier-generated PDF label. If the label hasn't been generated yet (most couriers take 1&ndash;5 minutes after order create), returns `409 NOT_READY` and you should retry.

```json
{ "data": { "url": "https://biteship-labels.s3.../label.pdf" }, "error": null, "meta": { ... } }
```

### Public tracking

```
GET /api/v1/shipping/track/:waybillId?courier=<code>
```

Looks up live tracking from the courier via Biteship. Use this on your own tracking page; it returns history, status, and (where the courier exposes it) driver info.

**Response shape**

```json
{
  "data": {
    "waybillId": "JNE1234567890",
    "courier": "jne",
    "status": "in_transit",
    "history": [
      { "status": "in_transit", "note": "On vehicle for delivery", "updated_at": "2026-05-13T05:00:00Z" }
    ],
    "driver": { "name": "Budi", "phone": "+62811...", "plate": "B 1234 XY", "photoUrl": null },
    "externalLink": "https://www.jne.co.id/...",
    "shipment": { "id": "ship_01HX...", "status": "in_transit", "events": [...] }
  },
  ...
}
```

## Status lifecycle

A shipment walks through these statuses, driven by inbound Biteship webhook events:

| Status | Means |
|---|---|
| `pending` | Created in Fulkruma, not yet sent to the courier (Phase E stub state). |
| `confirmed` | Courier accepted the order. |
| `allocated` | Driver assigned (instant/same-day only). |
| `picking_up` | Driver en route to origin. |
| `picked_up` | Parcel collected. |
| `dropping_off` | Driver en route to destination. |
| `in_transit` | Standard couriers: on the truck. |
| `delivered` | Recipient confirmed receipt. Emits `fulkruma.shipment.delivered.v1` (reserved). |
| `returned` | Failed delivery, returned to sender. |
| `cancelled` | Cancelled before or during transit. |

## The shipment object

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | no | Fulkruma ID. Always `ship_` + 26-char ULID. |
| `accountId` | string | no | The workspace this shipment belongs to. |
| `status` | enum | no | Current status. See [the lifecycle](#status-lifecycle). |
| `courierCode` | string | no | E.g. `jne`, `sicepat`. |
| `courierServiceCode` | string | no | E.g. `reg`, `yes`. |
| `courierType` | string | no | `standard`, `same_day`, or `instant`. |
| `price` | integer | no | Shipping price (cents). |
| `insurance` | integer | no | Insurance premium (cents). |
| `insured` | boolean | no | Whether insurance was elected. |
| `biteshipOrderId` | string | no | Biteship's order ID, or a `pending-` placeholder if the Phase F adapter hasn't yet been wired in. |
| `waybillId` | string | yes | Courier-issued waybill (AWB). Populates after courier acceptance. |
| `labelUrl` | string | yes | URL of the courier-generated PDF label. |
| `biteshipTrackingId` | string | yes | Biteship's internal tracking ID. |
| `originSnapshot` | object | no | Origin captured at create time. |
| `destinationSnapshot` | object | no | Destination captured at create time. |
| `items` | array | no | Items captured at create time. |
| `customerEmail` | string | yes | Buyer email. |
| `customerId` | string | yes | Fulkruma customer ID. |
| `checkoutSessionId` | string | yes | Plugipay checkout session that originated the order. |
| `productId` | string | yes | Linked Fulkruma product. |
| `externalSource` | string | yes | Origin system (e.g. `storlaunch`). |
| `externalRef` | string | yes | Origin system's order ID. |
| `events` | array | &mdash; | Inlined on retrieve. See [ShipmentEvent](#the-shipment-event-object). |
| `createdAt` | string (ISO 8601 UTC) | no | Creation timestamp. |
| `updatedAt` | string (ISO 8601 UTC) | no | Last mutation timestamp. |

### The shipment event object

| Field | Type | Description |
|---|---|---|
| `id` | string (`evt_…`) | Event ID. |
| `shipmentId` | string | The parent shipment. |
| `status` | string | The status this event transitioned to. |
| `note` | string \| null | Free-form courier-supplied note. |
| `occurredAt` | string (ISO 8601 UTC) | When the courier recorded the event. |

## Events

| Event type | Fires on | Notes |
|---|---|---|
| `fulkruma.shipment.created.v1` | `POST /api/v1/shipments` succeeds. | Emitted in the same transaction as the shipment insert. |

`shipment.in_transit`, `shipment.delivered`, `shipment.returned`, and `shipment.cancelled` are reserved in the catalog but **not currently emitted** &mdash; track lifecycle via polling or the `/track/:waybillId` endpoint until those land. If you need them sooner, raise it at **hello@fulkruma.com**.

See [**Webhooks**](/docs/api/resources/webhooks) for the event envelope and signature recipe.

## Next

- [**Shipping**](/docs/api/resources/shipping) &mdash; rate quotes, courier catalog, origin config.
- [**Stock**](/docs/api/resources/stock) &mdash; reservations consumed by shipments.
- [**Addresses**](/docs/api/resources/addresses) &mdash; saved destination addresses.
- [**Portal &rarr; Shipments**](/docs/portal/shipments) &mdash; the dashboard walkthrough.
