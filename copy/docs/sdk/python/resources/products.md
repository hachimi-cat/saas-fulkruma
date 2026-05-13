---
title: Products
---

# Products

A product is the catalog entry buyers see. Each product has one or more variants (size, color, SKU-level differences) and every stock row + shipment line + license pin to a variant, not the product. The Python SDK exposes both layers behind `fulkruma.products`. For HTTP shapes and the full field reference, see [**API &rarr; Products**](/docs/api/resources/products).

## Namespace

```python
fulkruma.products       # ProductsResources
```

Every method below shares the same `httpx.Client` as the parent.

## Methods

### `create`

```python
fulkruma.products.create(body: dict, *, on_behalf_of: str | None = None) -> dict
```

Creates a product. Only `name` is required. `type` defaults to `"physical"`; pass `"digital"` for download-only goods (which then unlock the deliveries + licenses surfaces) or `"service"` for non-stocked offerings. The SDK auto-mints an idempotency key, so retries are safe.

```python
result = fulkruma.products.create({
    "name": "Pawpado Premium License",
    "type": "digital",
    "description": "GPU portal — 12-month subscription",
    "licenseEnabled": True,
    "maxActivations": 3,
    "externalRef": "sku-pawpado-premium-12m",
    "externalSource": "storlaunch",
})

print(result["product"]["id"])  # "prod_01HX..."
```

### `get`

```python
fulkruma.products.get(product_id: str, *, on_behalf_of: str | None = None) -> dict
```

Fetches one product + every variant in one response. Raises `FulkrumaError(404, "not_found", ...)` for missing or cross-workspace IDs.

```python
result = fulkruma.products.get("prod_01HX...")
print(len(result["product"]["variants"]), "variants")
```

### `list`

```python
fulkruma.products.list(
    *,
    archived: bool | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Returns every product in the workspace. Pass `archived=True` to include archived ones, `archived=False` (or omit) to exclude. Not paginated.

```python
result = fulkruma.products.list(archived=False)
for p in result["products"]:
    print(p["name"], len(p["variants"]), "variants")
```

### `update`

```python
fulkruma.products.update(
    product_id: str,
    patch: dict,
    *,
    on_behalf_of: str | None = None,
) -> dict
```

Partial update. To toggle license-mode on an existing product, pass `{"licenseEnabled": True}`; the next `licenses.issue` call will succeed instead of returning `400`.

```python
fulkruma.products.update("prod_01HX...", {
    "description": "Updated copy",
    "licenseEnabled": True,
})
```

### `archive`

```python
fulkruma.products.archive(product_id: str, *, on_behalf_of: str | None = None) -> dict
```

Soft-delete. Variants archive alongside the parent automatically. Historic shipments/licenses/stock movements still reference the archived product so audit trails keep working.

```python
fulkruma.products.archive("prod_01HX...")
```

### `add_variant`

```python
fulkruma.products.add_variant(
    product_id: str,
    body: dict,
    *,
    on_behalf_of: str | None = None,
) -> dict
```

Adds a variant. `name` is required (e.g. `"Size L / Red"`); SKU, prices, low-stock threshold, weight are optional.

```python
result = fulkruma.products.add_variant("prod_01HX...", {
    "name": "Size L",
    "sku": "TSHIRT-L",
    "priceCents": 2_500_000,
    "costCents": 1_250_000,
    "lowStockThreshold": 5,
    "isDefault": True,
})
print(result["variant"]["id"])
```

Variants share the parent product's `type` &mdash; you can't mix physical + digital variants under one product.

### `update_variant` / `archive_variant`

```python
fulkruma.products.update_variant(
    product_id: str, variant_id: str, patch: dict,
    *, on_behalf_of: str | None = None,
) -> dict

fulkruma.products.archive_variant(
    product_id: str, variant_id: str,
    *, on_behalf_of: str | None = None,
) -> dict
```

```python
fulkruma.products.update_variant("prod_01HX...", "var_01HX...", {
    "priceCents": 3_000_000,
})

fulkruma.products.archive_variant("prod_01HX...", "var_01HX...")
```

Archiving the last live variant on a product is allowed but unusual &mdash; you typically archive the whole product instead.

## Types

Every method returns a plain dict matching the API envelope. The product shape:

```python
{
    "product": {
        "id": "prod_...",
        "accountId": "acc_...",
        "name": "...",
        "sku": "..." | None,
        "description": "..." | None,
        "type": "physical" | "digital" | "service",
        "weight": float | None,
        "licenseEnabled": bool,
        "maxActivations": int | None,
        "externalRef": "..." | None,
        "externalSource": "..." | None,
        "variants": [{...}, ...],
        "archivedAt": "..." | None,
        "createdAt": "...",
        "updatedAt": "..."
    }
}
```

See [**API &rarr; Products**](/docs/api/resources/products) for per-field validation rules.

## Common patterns

**Create a simple product with one default variant.** Most products have one SKU:

```python
def create_simple(fulkruma, name: str, sku: str, price_cents: int) -> str:
    pres = fulkruma.products.create({"name": name})
    product_id = pres["product"]["id"]
    fulkruma.products.add_variant(product_id, {
        "name": "Default",
        "sku": sku,
        "priceCents": price_cents,
        "isDefault": True,
    })
    return product_id
```

**Sync from your own catalog.** If Storlaunch (or another upstream) owns the source-of-truth catalog, use `externalRef` to dedupe:

```python
def upsert_product(fulkruma, ext_ref: str, name: str, price_cents: int) -> str:
    result = fulkruma.products.list()
    existing = next((p for p in result["products"] if p.get("externalRef") == ext_ref), None)
    if existing:
        fulkruma.products.update(existing["id"], {"name": name})
        return existing["id"]
    pres = fulkruma.products.create({
        "name": name,
        "externalRef": ext_ref,
        "externalSource": "storlaunch",
    })
    pid = pres["product"]["id"]
    fulkruma.products.add_variant(pid, {
        "name": "Default", "priceCents": price_cents, "isDefault": True,
    })
    return pid
```

**Branch on conflicts.** A duplicate `externalRef` + `externalSource` returns `409 conflict`:

```python
from fulkruma import FulkrumaError

try:
    fulkruma.products.create({"name": "X", "externalRef": "abc", "externalSource": "storlaunch"})
except FulkrumaError as err:
    if err.status == 409 and err.code == "conflict":
        pass  # already exists, look up by externalRef
    else:
        raise
```

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Missing `name`, bad `type`, negative `priceCents`. |
| `404` | `not_found` | Product or variant ID missing or in another workspace. |
| `409` | `conflict` | Archive with live stock; duplicate `externalRef`+`externalSource`. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:product:write`. |

See [**Errors**](/docs/sdk/python/errors) for the full hierarchy.

## Next

- [**Stock**](/docs/sdk/python/resources/stock) &mdash; per-variant per-warehouse inventory.
- [**Licenses**](/docs/sdk/python/resources/licenses) &mdash; digital-product license keys.
- [**API &rarr; Products**](/docs/api/resources/products) &mdash; HTTP-level reference.
