---
title: Warehouses
---

# Warehouses

A **warehouse** is a stock location: a physical address (or virtual bin) where inventory is held. Every variant stock level, stock movement, reservation, and outbound shipment hangs off a warehouse. The first warehouse you create is auto-flagged `isDefault: true` and used as the implicit source for movements that don't name one explicitly. See [**Concepts &rarr; Warehouse**](/docs/concepts) for the data model and [**Portal &rarr; Warehouses**](/docs/portal/warehouses) for the dashboard equivalent.

All requests on this page must be signed &mdash; see [**Authentication**](/docs/api/authentication) for the `Fulkruma-HMAC-SHA256` recipe &mdash; and follow the response envelope described in the [**API overview**](/docs/api#response-envelope).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/warehouses` | List warehouses |
| `POST` | `/api/v1/warehouses` | Create a warehouse |
| `PATCH` | `/api/v1/warehouses/:id` | Update a warehouse |
| `DELETE` | `/api/v1/warehouses/:id` | Soft-archive a warehouse |

Retrieve-one is **not currently exposed** &mdash; list the resource and filter client-side. The list endpoint always returns the workspace's full set; warehouses are deliberately a low-cardinality resource (most merchants have one).

### List warehouses

```
GET /api/v1/warehouses
```

Returns every non-archived warehouse in the workspace, ordered with the default first, then by `createdAt` ascending. Pagination is not supported and not needed &mdash; the page caps out at the workspace's warehouse count, which is plan-limited.

**Response** &mdash; `200 OK`

```json
{
  "data": {
    "warehouses": [
      {
        "id": "wh_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "accountId": "acc_01HXxxxxxxxxxxxxxxxxxxxxxx",
        "name": "Main warehouse",
        "address": "Jl. Sudirman 123",
        "city": "Jakarta",
        "postal": "10220",
        "lat": -6.2088,
        "lng": 106.8456,
        "phone": "+628111111111",
        "isDefault": true,
        "archived": false,
        "createdAt": "2026-05-12T10:42:00.123Z",
        "updatedAt": "2026-05-12T10:42:00.123Z"
      }
    ]
  },
  "error": null,
  "meta": {
    "requestId": "req_01HX...",
    "timestamp": "2026-05-12T10:42:00.124Z"
  }
}
```

```js
// Node
import { Fulkruma } from '@forjio/fulkruma';
const fk = new Fulkruma({ keyId: process.env.FULKRUMA_KEY_ID, secret: process.env.FULKRUMA_KEY_SECRET });

const { warehouses } = await fk.warehouses.list();
console.log(warehouses[0].id); // wh_...
```

```python
# Python
from fulkruma import Fulkruma
fk = Fulkruma(key_id=os.environ['FULKRUMA_KEY_ID'], secret=os.environ['FULKRUMA_KEY_SECRET'])

warehouses = fk.warehouses.list()['warehouses']
```

```go
// Go
import fulkruma "github.com/hachimi-cat/fulkruma-go"
client := fulkruma.New(os.Getenv("FULKRUMA_KEY_ID"), os.Getenv("FULKRUMA_KEY_SECRET"))
res, err := client.Warehouses.List(ctx)
```

```bash
# curl (assumes the fulkruma_curl helper from /docs/api/authentication)
fulkruma_curl GET '/api/v1/warehouses'
```

### Create a warehouse

```
POST /api/v1/warehouses
```

Creates a warehouse in the calling workspace (or the merchant workspace named by `X-Fulkruma-On-Behalf-Of` for Pattern 2 partners). The first warehouse in a workspace is auto-flagged `isDefault: true` regardless of the request body; subsequent warehouses default to `isDefault: false` unless you opt in.

An **Idempotency-Key** header is required &mdash; see the [API overview](/docs/api#idempotency).

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string (1&ndash;120) | yes | Human-readable label. Shown on the dashboard and in shipping origin display. |
| `address` | string | no | Street address. Free-form. Required at rate-quote time; safe to skip on create and patch in later. |
| `city` | string | no | City name. Used for province-level rate matching. |
| `postal` | string | no | Postal code. |
| `lat` | number | no | Latitude (decimal degrees). Required if you intend to enable instant couriers (gosend, grab). |
| `lng` | number | no | Longitude (decimal degrees). |
| `phone` | string | no | Contact phone for the courier driver. |
| `isDefault` | boolean | no | Promote this warehouse to default. If you pass `true`, no other warehouse is demoted &mdash; you currently have to PATCH the prior default to `isDefault: false` yourself. The first warehouse always lands as default regardless. |

**Response** &mdash; `201 Created`

```json
{
  "data": {
    "warehouse": {
      "id": "wh_01HXAB7K3M9N2P5QRS8TVWXY3Z",
      "accountId": "acc_01HXxxxxxxxxxxxxxxxxxxxxxx",
      "name": "Main warehouse",
      "city": "Jakarta",
      "isDefault": true,
      "archived": false,
      "createdAt": "2026-05-12T10:42:00.123Z",
      "updatedAt": "2026-05-12T10:42:00.123Z"
    }
  },
  "error": null,
  "meta": { "requestId": "req_01HX...", "timestamp": "2026-05-12T10:42:00.124Z" }
}
```

**Errors specific to this endpoint**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | `name` missing or longer than 120 chars; numeric fields not numeric. |
| `403` | `NO_ACCOUNT` | Token authenticated but has no `accountId` claim. |

Other 4xx/5xx errors follow the standard table in the [**API overview**](/docs/api#response-envelope).

```js
// Node
const { warehouse } = await fk.warehouses.create({
  name: 'Main warehouse',
  address: 'Jl. Sudirman 123',
  city: 'Jakarta',
  postal: '10220',
  phone: '+628111111111',
});
```

```python
# Python
warehouse = fk.warehouses.create(
    name='Main warehouse',
    address='Jl. Sudirman 123',
    city='Jakarta',
    postal='10220',
    phone='+628111111111',
)['warehouse']
```

```bash
# curl
fulkruma_curl POST '/api/v1/warehouses' \
  '{"name":"Main warehouse","address":"Jl. Sudirman 123","city":"Jakarta","postal":"10220"}'
```

### Update a warehouse

```
PATCH /api/v1/warehouses/:id
```

Partial update &mdash; send only the fields you want to change. Omitted fields are left untouched. The accepted body is identical in shape to create, with every field optional.

**Path parameters**

| Param | Type | Description |
|---|---|---|
| `id` | string (`wh_…`) | The warehouse to update. |

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Field shape wrong. |
| `404` | `NOT_FOUND` | Warehouse doesn't exist or is in another workspace. |

<blockquote class="callout-tip">

**Patch the prior default to `false` first.** Setting `isDefault: true` on a new warehouse does not demote the previous default; you'll have two defaults until you clear the old one. The portal does this in one transaction; the API requires two calls.

</blockquote>

```js
// Node
await fk.warehouses.update('wh_01HXAB7K3M9N2P5QRS8TVWXY3Z', {
  lat: -6.2088,
  lng: 106.8456,
});
```

```bash
# curl
fulkruma_curl PATCH '/api/v1/warehouses/wh_01HXAB7K3M9N2P5QRS8TVWXY3Z' \
  '{"lat":-6.2088,"lng":106.8456}'
```

### Archive a warehouse

```
DELETE /api/v1/warehouses/:id
```

Soft-archives the warehouse &mdash; sets `archived: true`. The row is not deleted: stock movement history, reservations, and shipments stay queryable and continue to reference it. Archived warehouses are excluded from the list endpoint and from the rate-quote source pool.

There is **no hard delete**. Archived warehouses can be unarchived by PATCHing `archived: false` if you ever need to. Stock currently sitting in the warehouse becomes inaccessible to new shipments until you reactivate it &mdash; transfer stock out first if you intend to retire the location.

**Response** &mdash; `200 OK`

```json
{ "data": { "archived": true }, "error": null, "meta": { ... } }
```

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `404` | `NOT_FOUND` | Warehouse doesn't exist or is in another workspace. |

## The warehouse object

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | no | Fulkruma ID. Always `wh_` + 26-char ULID. Stable forever. |
| `accountId` | string | no | The workspace this warehouse belongs to. |
| `name` | string | no | Human-readable label. |
| `address` | string | yes | Street address. |
| `city` | string | yes | City name. |
| `postal` | string | yes | Postal code. |
| `lat` | number | yes | Latitude (decimal degrees). |
| `lng` | number | yes | Longitude (decimal degrees). |
| `phone` | string | yes | Driver-facing contact. |
| `isDefault` | boolean | no | Whether this warehouse is the implicit source for movements and shipments. |
| `archived` | boolean | no | Whether the warehouse is soft-archived. Archived warehouses don't appear in the list endpoint. |
| `createdAt` | string (ISO 8601 UTC) | no | Creation timestamp. |
| `updatedAt` | string (ISO 8601 UTC) | no | Last mutation timestamp. |

## Events

State changes on warehouses do **not** currently emit outbox events. If you need to mirror warehouse mutations into another system, poll `GET /api/v1/warehouses` periodically and reconcile by `updatedAt`. The roadmap includes `warehouse.created.v1` and `warehouse.archived.v1` &mdash; if your workflow needs them sooner, raise it at **hello@fulkruma.com**.

See the [**Webhooks resource**](/docs/api/resources/webhooks) for the event envelope, retry policy, and signature recipe.

## Next

- [**Stock**](/docs/api/resources/stock) &mdash; per-variant per-warehouse quantity and the movement audit trail.
- [**Shipping**](/docs/api/resources/shipping) &mdash; configure the shipping origin (separate from warehouse address) and pull rate quotes.
- [**Portal &rarr; Warehouses**](/docs/portal/warehouses) &mdash; the dashboard walkthrough.
- [**Authentication**](/docs/api/authentication) &mdash; the HMAC signing recipe.
