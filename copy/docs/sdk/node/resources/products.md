---
title: Products
---

# Products

A **product** is the catalog entry buyers see. Each product has one or more **variants** (size, color, SKU-level differences) and every stock row + shipment line + license pin to a variant, not the product. The Node SDK exposes both layers behind the `fulkruma.products` namespace. For the underlying HTTP surface and the full field tables, see [API: Products](/docs/api/resources/products).

## Namespace

`fulkruma.products` &mdash; every method:

```ts
fulkruma.products.create(input)
fulkruma.products.get(id)
fulkruma.products.list(params?)
fulkruma.products.update(id, patch)
fulkruma.products.archive(id)
fulkruma.products.addVariant(productId, input)
fulkruma.products.updateVariant(productId, variantId, patch)
fulkruma.products.archiveVariant(productId, variantId)
```

Eight methods &mdash; four for products, three for variants, plus `archive`. There's no top-level `variants` namespace; variants are always addressed via their parent product so the URL space stays nested.

## Methods

### `products.create`

**Signature.** `fulkruma.products.create(input): Promise<{ product: Product }>`

Creates a product. Only `name` is required. `type` defaults to `physical`; pass `digital` for download-only goods (which then unlock the deliveries + licenses surfaces) or `license` for software sold as a key. The SDK auto-mints an `Idempotency-Key`, so retries against transient network errors are safe.

```ts
const { product } = await fulkruma.products.create({
  name: 'Pawpado Premium License',
  type: 'digital',
  description: 'GPU portal — 12-month subscription',
  licenseEnabled: true,
  maxActivations: 3,
  sku: 'pawpado-premium-12m',
});
```

`sku` is your handle into your own catalog. Products that Storlaunch mirrors into Fulkruma also carry `externalRef` + `externalSource` (`"storlaunch"`); those are set by that sync only &mdash; `create` and `update` don't accept them.

### `products.get`

**Signature.** `fulkruma.products.get(id): Promise<{ product: Product }>`

Fetches one product + every variant in a single response. Returns `404 not_found` for missing or cross-workspace IDs.

```ts
const { product } = await fulkruma.products.get('prod_01HX...');
console.log(product.variants.length);
```

### `products.list`

**Signature.** `fulkruma.products.list(params?): Promise<{ products: Product[] }>`

Returns every product in the workspace. Pass `archived: true` to include archived ones, `archived: false` (or omit) to exclude. Not paginated &mdash; we expect catalogs in the hundreds, not millions.

```ts
const { products } = await fulkruma.products.list({ archived: false });
for (const p of products) {
  console.log(p.name, p.variants.length, 'variants');
}
```

### `products.update`

**Signature.** `fulkruma.products.update(id, patch): Promise<{ product: Product }>`

PATCH semantics. To toggle license-mode on an existing product, pass `licenseEnabled: true`; the next `licenses.issue` call against that product will succeed instead of returning `400`.

```ts
await fulkruma.products.update('prod_01HX...', {
  description: 'Updated copy',
  licenseEnabled: true,
});
```

### `products.archive`

**Signature.** `fulkruma.products.archive(id): Promise<{ archived: boolean }>`

Soft-delete. Variants archive alongside the parent automatically. Historic shipments/licenses/stock movements still reference the archived product so audit trails keep working.

```ts
await fulkruma.products.archive('prod_01HX...');
```

### `products.addVariant`

**Signature.** `fulkruma.products.addVariant(productId, input): Promise<{ variant: ProductVariant }>`

Adds a variant. `name` is required (e.g. `'Size L / Red'`); SKU, prices, low-stock threshold, and weight are optional. Set `isDefault: true` to make this the variant that pre-selects in checkout flows.

```ts
const { variant } = await fulkruma.products.addVariant('prod_01HX...', {
  name: 'Size L',
  sku: 'TSHIRT-L',
  priceCents: 25_000_00,    // IDR 25,000
  costCents: 12_500_00,
  lowStockThreshold: 5,
  isDefault: true,
});
```

Variants share the parent product's `type` &mdash; you can't mix physical + digital variants under one product.

### `products.updateVariant` / `products.archiveVariant`

```ts
await fulkruma.products.updateVariant('prod_01HX...', 'var_01HX...', {
  priceCents: 30_000_00,
});

await fulkruma.products.archiveVariant('prod_01HX...', 'var_01HX...');
```

Archiving the last live variant on a product is allowed but unusual &mdash; you typically archive the whole product instead.

## Types

```ts
type ProductType = 'physical' | 'digital' | 'license';

interface Product {
  id: string;              // 'prod_...'
  accountId: string;
  name: string;
  sku: string | null;
  description: string | null;
  type: ProductType;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  licenseEnabled: boolean;
  maxActivations: number | null;
  externalRef: string | null;
  externalSource: string | null;
  variants: ProductVariant[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductVariant {
  id: string;              // 'var_...'
  productId: string;
  name: string;
  sku: string | null;
  priceCents: number | null;
  costCents: number | null;
  lowStockThreshold: number | null;
  weight: number | null;
  isDefault: boolean;
  externalRef: string | null;
  externalSource: string | null;
  archivedAt: string | null;
}
```

For per-field validation rules and the full server-only field list (e.g. `arn`), see [API: Products](/docs/api/resources/products).

## Common patterns

### Create a product with one default variant

Most products only have one SKU. Create the product, then the variant, in two calls:

```ts
async function createSimple(name: string, sku: string, priceCents: number) {
  const { product } = await fulkruma.products.create({ name });
  await fulkruma.products.addVariant(product.id, {
    name: 'Default',
    sku,
    priceCents,
    isDefault: true,
  });
  return product.id;
}
```

### Sync from your own catalog

If your own system owns the source-of-truth catalog, use `sku` to dedupe:

```ts
async function upsertProduct(sku: string, attrs: { name: string; priceCents: number }) {
  const { products } = await fulkruma.products.list();
  const existing = products.find((p) => p.sku === sku);
  if (existing) {
    await fulkruma.products.update(existing.id, { name: attrs.name });
    return existing.id;
  }
  const { product } = await fulkruma.products.create({
    name: attrs.name,
    sku,
  });
  await fulkruma.products.addVariant(product.id, {
    name: 'Default',
    priceCents: attrs.priceCents,
    isDefault: true,
  });
  return product.id;
}
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `VALIDATION` | 400 | Missing `name`, bad `type`, a negative dimension or price. |
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |
| `NOT_FOUND` | 404 | Product or variant ID missing or in another workspace. |

## Next

- [Stock](/docs/sdk/node/resources/stock) &mdash; per-variant per-warehouse inventory.
- [Licenses](/docs/sdk/node/resources/licenses) &mdash; digital-product license keys.
- [API: Products](/docs/api/resources/products) &mdash; HTTP reference.
