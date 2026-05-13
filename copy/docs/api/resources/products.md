---
title: Products
---

# Products

A **product** is something you sell &mdash; with one or more **variants** under it that carry SKU, price, and stock-level distinctness. Fulkruma's `Product` is a fulfilment-oriented record: it doesn't replace your storefront catalog (that belongs to Storlaunch or your own commerce platform), it gives Fulkruma enough to ship, deliver, or license-key the thing.

Products come in three **types**:

- `physical` &mdash; needs warehousing, stock tracking, and a shipment to deliver.
- `digital` &mdash; no stock; fulfilled via a [delivery](/docs/api/resources/deliveries) grant.
- `license` &mdash; no stock; fulfilled by issuing a [license key](/docs/api/resources/licenses) at checkout.

A product can have many [variants](#variants). Every product gets an auto-created `Default` variant on creation; you only need to add more if you sell size/color/SKU permutations.

All requests on this page must be signed &mdash; see [**Authentication**](/docs/api/authentication). The response envelope and error codes are described in the [**API overview**](/docs/api#response-envelope).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/products` | List products |
| `GET` | `/api/v1/products/:id` | Retrieve one product |
| `POST` | `/api/v1/products` | Create a product |
| `PATCH` | `/api/v1/products/:id` | Update a product |
| `DELETE` | `/api/v1/products/:id` | Soft-archive a product |
| `POST` | `/api/v1/products/:id/variants` | Add a variant |
| `PATCH` | `/api/v1/products/:id/variants/:variantId` | Update a variant |
| `DELETE` | `/api/v1/products/:id/variants/:variantId` | Soft-archive a variant |

### List products

```
GET /api/v1/products
```

Returns up to 200 products in the workspace, newest first, with their variants expanded inline.

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `archived` | `true` \| `false` | `false` | If `true`, includes archived products. Default omits them. |

**Response** &mdash; `200 OK`

```json
{
  "data": {
    "products": [
      {
        "id": "prod_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "accountId": "acc_01HXxxxxxxxxxxxxxxxxxxxxxx",
        "name": "Espresso Beans 250g",
        "sku": "BEANS-250",
        "description": "Single-origin from Java.",
        "type": "physical",
        "weight": 280,
        "length": 12,
        "width": 8,
        "height": 4,
        "licenseEnabled": false,
        "maxActivations": null,
        "archived": false,
        "externalSource": null,
        "externalRef": null,
        "createdAt": "2026-05-12T10:42:00.123Z",
        "updatedAt": "2026-05-12T10:42:00.123Z",
        "variants": [
          {
            "id": "var_01HXAB7K3M9N2P5QRS8TVWXY3Z",
            "productId": "prod_01HX...",
            "sku": "BEANS-250-LIGHT",
            "name": "Light roast",
            "priceCents": 12000000,
            "costCents": 6500000,
            "lowStockThreshold": 5,
            "weight": 280,
            "isDefault": true,
            "archived": false
          }
        ]
      }
    ]
  },
  "error": null,
  "meta": { "requestId": "req_01HX...", "timestamp": "2026-05-12T10:42:00.124Z" }
}
```

```js
// Node
const { products } = await fk.products.list({ archived: false });
```

```bash
# curl
fulkruma_curl GET '/api/v1/products?archived=false'
```

### Retrieve a product

```
GET /api/v1/products/:id
```

Returns the product with the given `id`, with its variants inlined.

**Path parameters**

| Param | Type | Description |
|---|---|---|
| `id` | string (`prod_…`) | The product ID. |

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `404` | `NOT_FOUND` | The product doesn't exist, or exists in a different workspace. Fulkruma returns `404` (not `403`) for cross-workspace IDs to avoid leaking their existence. |

```bash
fulkruma_curl GET '/api/v1/products/prod_01HXAB7K3M9N2P5QRS8TVWXY3Z'
```

### Create a product

```
POST /api/v1/products
```

Creates a product in the calling workspace. A `Default` variant is automatically created in the same transaction so the product is immediately usable for shipments and stock movements. Emits a [`fulkruma.product.created.v1`](/docs/api/webhooks/events/fulkruma.product.created) event.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string (1&ndash;200) | yes | Display name. |
| `sku` | string | no | Product-level SKU. Variants can override. |
| `description` | string | no | Free-form description. |
| `type` | `physical` \| `digital` \| `license` | no | Default `physical`. Determines fulfilment path at checkout: physical &rarr; shipment, digital &rarr; delivery grant, license &rarr; license key issue. Immutable after create &mdash; create a new product instead. |
| `weight` | integer | no | Grams. Used for shipping weight when no variant override is set. |
| `length` | integer | no | Centimetres. Used for dimensional shipping calcs. |
| `width` | integer | no | Centimetres. |
| `height` | integer | no | Centimetres. |
| `licenseEnabled` | boolean | no | For `type: license` products, whether license issuance is on. |
| `maxActivations` | integer | no | Default `maxActivations` for licenses issued against this product. |

**Response** &mdash; `201 Created`. The full product object with the auto-created `Default` variant inlined.

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Field shape wrong, missing `name`, or invalid `type`. |
| `403` | `NO_ACCOUNT` | Token authenticated but has no `accountId` claim. |

```js
// Node
const { product } = await fk.products.create({
  name: 'Espresso Beans 250g',
  sku: 'BEANS-250',
  type: 'physical',
  weight: 280,
});
```

```python
# Python
product = fk.products.create(
    name='Espresso Beans 250g',
    sku='BEANS-250',
    type='physical',
    weight=280,
)['product']
```

```bash
# curl
fulkruma_curl POST '/api/v1/products' \
  '{"name":"Espresso Beans 250g","sku":"BEANS-250","type":"physical","weight":280}'
```

### Update a product

```
PATCH /api/v1/products/:id
```

Partial update &mdash; send only the fields you want to change. `type` cannot be changed once set; create a new product if you need to switch fulfilment path.

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Field shape wrong. |
| `404` | `NOT_FOUND` | Product not in this workspace. |

```bash
fulkruma_curl PATCH '/api/v1/products/prod_01HXAB7K3M9N2P5QRS8TVWXY3Z' \
  '{"description":"Single-origin from Aceh."}'
```

### Archive a product

```
DELETE /api/v1/products/:id
```

Soft-archives the product. Stock history, shipments referencing it, and any issued licenses or deliveries remain intact and queryable. Archived products are hidden from the default `list` response &mdash; pass `?archived=true` to include them.

There is no hard delete. Unarchive by PATCHing the row externally; the field is settable.

```bash
fulkruma_curl DELETE '/api/v1/products/prod_01HXAB7K3M9N2P5QRS8TVWXY3Z'
```

## Variants

A variant is a unique sellable line under a product. Stock levels and reservations are keyed by `(variantId, warehouseId)`, never by `productId` directly &mdash; so a product with only the auto-created `Default` variant still stocks against that variant ID.

### Add a variant

```
POST /api/v1/products/:id/variants
```

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string (1&ndash;160) | yes | Variant label (e.g. `Light roast`, `Large / Blue`). |
| `sku` | string | no | Variant SKU. Unique within a product (workspace-scoped uniqueness is not enforced). |
| `priceCents` | integer (&ge;0) | no | Price in the smallest currency unit (IDR cents, USD cents). Storlaunch uses this for product mirroring. |
| `costCents` | integer (&ge;0) | no | Wholesale cost; used for margin reports. |
| `lowStockThreshold` | integer (&ge;0) | no | Triggers a `stock.low` notification when on-hand falls to or below this. |
| `weight` | integer (&ge;0) | no | Grams. Overrides the product-level weight at shipping time. |
| `isDefault` | boolean | no | Promote this variant to the product's default. Demotes any existing default in the same transaction. |

```js
const { variant } = await fk.products.variants.create('prod_01HX...', {
  name: 'Light roast',
  sku: 'BEANS-250-LIGHT',
  priceCents: 12_000_000,
  weight: 280,
});
```

### Update a variant

```
PATCH /api/v1/products/:id/variants/:variantId
```

Partial update with the same schema. Promoting one variant to `isDefault: true` demotes the previously-default sibling atomically.

### Archive a variant

```
DELETE /api/v1/products/:id/variants/:variantId
```

Soft-archives the variant. Stock movement history and any open reservations against it remain. A product must have at least one non-archived variant to participate in new shipments.

## The product object

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | no | Fulkruma ID. Always `prod_` + 26-char ULID. |
| `accountId` | string | no | The workspace this product belongs to. |
| `name` | string | no | Display name. |
| `sku` | string | yes | Product-level SKU. |
| `description` | string | yes | Free-form description. |
| `type` | string | no | `physical`, `digital`, or `license`. Immutable. |
| `weight` | integer | yes | Default weight (g) at shipping. |
| `length` | integer | yes | Default length (cm). |
| `width` | integer | yes | Default width (cm). |
| `height` | integer | yes | Default height (cm). |
| `licenseEnabled` | boolean | no | For `license` products, whether issuance is on. |
| `maxActivations` | integer | yes | Default max activations on issued licenses. |
| `externalSource` | string | yes | Where the product was synced from. `storlaunch` for products mirrored via Storlaunch's product-sync webhook; `null` for products created directly in Fulkruma. |
| `externalRef` | string | yes | The originating system's ID (e.g. Storlaunch's `product_…`). Combined with `externalSource`, lets you reverse-look up the source record. |
| `archived` | boolean | no | Whether the product is soft-archived. |
| `createdAt` | string (ISO 8601 UTC) | no | Creation timestamp. |
| `updatedAt` | string (ISO 8601 UTC) | no | Last mutation timestamp. |
| `variants` | array | no | Inlined on `list` and `retrieve`. See [the variant object](#the-variant-object). |

### The variant object

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | no | Fulkruma ID. Always `var_` + 26-char ULID. |
| `productId` | string | no | The parent product. |
| `name` | string | no | Variant label. |
| `sku` | string | yes | Variant SKU. |
| `priceCents` | integer | yes | Price in minor units. |
| `costCents` | integer | yes | Wholesale cost in minor units. |
| `lowStockThreshold` | integer | yes | Quantity below which a low-stock alert fires. |
| `weight` | integer | yes | Per-variant override. |
| `isDefault` | boolean | no | Whether this is the product's default variant. |
| `archived` | boolean | no | Whether the variant is soft-archived. |

## Events

| Event type | Fires on | Notes |
|---|---|---|
| `fulkruma.product.created.v1` | `POST /api/v1/products` succeeds. | Emitted in the same transaction as the product insert, delivered at-least-once. |

`product.updated`, `product.archived`, `variant.created`, and `variant.archived` are on the roadmap but **not currently emitted.** Audit-log rows are written for every variant create/update/archive even though no webhook fires &mdash; see [**Audit log**](/docs/api/resources/audit-log).

See [**Webhooks**](/docs/api/resources/webhooks) for the event envelope and signature recipe.

## Pattern 2: Storlaunch product mirroring

When Storlaunch is your storefront, products are mirrored into Fulkruma via the inbound `storlaunch.product.synced` webhook. Those rows carry `externalSource: "storlaunch"` and `externalRef: "prod_<storlaunchId>"`. Treat them as read-only on the Fulkruma side: edits in Storlaunch overwrite the mirror, and edits made directly in Fulkruma will be overwritten on the next sync.

If you need to enrich a Storlaunch-sourced product with Fulkruma-only data, store it in your own system and join by `externalRef`.

## Next

- [**Stock**](/docs/api/resources/stock) &mdash; per-variant per-warehouse quantity and the movement audit trail.
- [**Shipments**](/docs/api/resources/shipments) &mdash; how a `physical` product gets to the buyer.
- [**Deliveries**](/docs/api/resources/deliveries) &mdash; how a `digital` product gets to the buyer.
- [**Licenses**](/docs/api/resources/licenses) &mdash; how a `license` product gets to the buyer.
- [**Portal &rarr; Products**](/docs/portal/products) &mdash; the dashboard walkthrough.
