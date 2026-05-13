---
title: Products
---

# Products

A **product** is the catalog entry buyers see. Each product has one or more **variants** (size, color, SKU-level differences) and every stock row + shipment line + license pin to a variant, not the product. The Go SDK exposes both layers behind `client.Products`. For wire shapes and the full field table, see [**API &rarr; Products**](/docs/api/resources/products).

## Field on the Client

`client.Products` &mdash; type `*fulkruma.ProductsResource`. Installed on the `*Client` returned by `NewClient`; shares the same `*http.Client`, base URL, key, and `OnBehalfOf` default as the parent.

## Methods

### Create

**Signature.** `func (r *ProductsResource) Create(ctx context.Context, in ProductCreateInput) (*Product, error)`

Creates a product. Only `Name` is required. `Type` defaults to `"physical"`; pass `fulkruma.ProductTypeDigital` for download-only goods (which then unlock deliveries + licenses) or `fulkruma.ProductTypeService` for non-stocked offerings. The SDK auto-mints an `Idempotency-Key`.

```go
licenseEnabled := true
maxAct := int64(3)

product, err := client.Products.Create(ctx, fulkruma.ProductCreateInput{
    Name:           "Pawpado Premium License",
    Type:           fulkruma.ProductTypeDigital,
    Description:    "GPU portal — 12-month subscription",
    LicenseEnabled: &licenseEnabled,
    MaxActivations: &maxAct,
    ExternalRef:    "sku-pawpado-premium-12m",
    ExternalSource: "storlaunch",
})
if err != nil {
    return err
}
log.Printf("created %s", product.ID)
```

### Get

**Signature.** `func (r *ProductsResource) Get(ctx context.Context, id string) (*Product, error)`

Fetches one product + every variant in one response. Returns `*fulkruma.Error{Status: 404, Code: "not_found"}` for missing or cross-workspace IDs.

```go
product, err := client.Products.Get(ctx, "prod_01HX...")
if err != nil {
    return err
}
fmt.Println(len(product.Variants), "variants")
```

### List

**Signature.** `func (r *ProductsResource) List(ctx context.Context, p ProductListParams) ([]Product, error)`

Pass `Archived: &true` to include archived products, `Archived: &false` (or nil) to exclude. Not paginated.

```go
notArchived := false
products, err := client.Products.List(ctx, fulkruma.ProductListParams{
    Archived: &notArchived,
})
for _, p := range products {
    fmt.Println(p.Name, len(p.Variants), "variants")
}
```

### Update

**Signature.** `func (r *ProductsResource) Update(ctx context.Context, id string, patch ProductUpdateInput) (*Product, error)`

`PATCH` semantics. Toggle license-mode by setting `LicenseEnabled: &true`.

```go
newDesc := "Updated copy"
enabled := true

product, err := client.Products.Update(ctx, "prod_01HX...", fulkruma.ProductUpdateInput{
    Description:    &newDesc,
    LicenseEnabled: &enabled,
})
```

### Archive

**Signature.** `func (r *ProductsResource) Archive(ctx context.Context, id string) (bool, error)`

Soft-delete. Variants archive alongside the parent automatically. Historic shipments/licenses/stock movements still reference the archived product.

```go
ok, err := client.Products.Archive(ctx, "prod_01HX...")
```

### AddVariant

**Signature.** `func (r *ProductsResource) AddVariant(ctx context.Context, productID string, in VariantCreateInput) (*ProductVariant, error)`

`Name` is required (e.g. `"Size L / Red"`); SKU, prices, low-stock threshold, weight are optional. Variants share the parent product's `Type`.

```go
priceCents := int64(2_500_000)
costCents := int64(1_250_000)
threshold := int64(5)
isDefault := true

variant, err := client.Products.AddVariant(ctx, "prod_01HX...", fulkruma.VariantCreateInput{
    Name:              "Size L",
    SKU:               "TSHIRT-L",
    PriceCents:        &priceCents,
    CostCents:         &costCents,
    LowStockThreshold: &threshold,
    IsDefault:         &isDefault,
})
```

### UpdateVariant / ArchiveVariant

```go
newPrice := int64(3_000_000)
variant, err := client.Products.UpdateVariant(ctx, "prod_01HX...", "var_01HX...",
    fulkruma.VariantUpdateInput{PriceCents: &newPrice},
)

ok, err := client.Products.ArchiveVariant(ctx, "prod_01HX...", "var_01HX...")
```

Archiving the last live variant on a product is allowed but unusual &mdash; you typically archive the whole product.

## Types

```go
type ProductType string

const (
    ProductTypePhysical ProductType = "physical"
    ProductTypeDigital  ProductType = "digital"
    ProductTypeService  ProductType = "service"
)

type Product struct {
    ID             string           `json:"id"`         // "prod_..."
    AccountID      string           `json:"accountId"`
    Name           string           `json:"name"`
    SKU            *string          `json:"sku"`
    Description    *string          `json:"description"`
    Type           ProductType      `json:"type"`
    Weight         *float64         `json:"weight"`
    LicenseEnabled bool             `json:"licenseEnabled"`
    MaxActivations *int64           `json:"maxActivations"`
    ExternalRef    *string          `json:"externalRef"`
    ExternalSource *string          `json:"externalSource"`
    Variants       []ProductVariant `json:"variants"`
    ArchivedAt     *string          `json:"archivedAt"`
    CreatedAt      string           `json:"createdAt"`
    UpdatedAt      string           `json:"updatedAt"`
}

type ProductVariant struct {
    ID                string  `json:"id"`         // "var_..."
    ProductID         string  `json:"productId"`
    Name              string  `json:"name"`
    SKU               *string `json:"sku"`
    PriceCents        *int64  `json:"priceCents"`
    CostCents         *int64  `json:"costCents"`
    LowStockThreshold *int64  `json:"lowStockThreshold"`
    Weight            *float64 `json:"weight"`
    IsDefault         bool    `json:"isDefault"`
    ExternalRef       *string `json:"externalRef"`
    ExternalSource    *string `json:"externalSource"`
    ArchivedAt        *string `json:"archivedAt"`
}
```

For per-field validation rules, see [**API &rarr; Products**](/docs/api/resources/products).

## Common patterns

### Create a simple product with one default variant

```go
func createSimple(ctx context.Context, c *fulkruma.Client, name, sku string, priceCents int64) (string, error) {
    product, err := c.Products.Create(ctx, fulkruma.ProductCreateInput{Name: name})
    if err != nil {
        return "", err
    }
    isDefault := true
    _, err = c.Products.AddVariant(ctx, product.ID, fulkruma.VariantCreateInput{
        Name:       "Default",
        SKU:        sku,
        PriceCents: &priceCents,
        IsDefault:  &isDefault,
    })
    return product.ID, err
}
```

### Sync from your own catalog

```go
func upsertProduct(ctx context.Context, c *fulkruma.Client, extRef, name string, priceCents int64) (string, error) {
    products, err := c.Products.List(ctx, fulkruma.ProductListParams{})
    if err != nil {
        return "", err
    }
    for _, p := range products {
        if p.ExternalRef != nil && *p.ExternalRef == extRef {
            newName := name
            _, err := c.Products.Update(ctx, p.ID, fulkruma.ProductUpdateInput{
                Name: &newName,
            })
            return p.ID, err
        }
    }
    product, err := c.Products.Create(ctx, fulkruma.ProductCreateInput{
        Name:           name,
        ExternalRef:    extRef,
        ExternalSource: "storlaunch",
    })
    if err != nil {
        return "", err
    }
    isDefault := true
    _, err = c.Products.AddVariant(ctx, product.ID, fulkruma.VariantCreateInput{
        Name: "Default", PriceCents: &priceCents, IsDefault: &isDefault,
    })
    return product.ID, err
}
```

### Branch on conflicts

```go
_, err := c.Products.Create(ctx, fulkruma.ProductCreateInput{
    Name: "X", ExternalRef: "abc", ExternalSource: "storlaunch",
})
var pe *fulkruma.Error
if errors.As(err, &pe) && pe.Code == "conflict" {
    // already exists, look up by externalRef
}
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Missing `Name`, bad `Type`, negative `PriceCents`. |
| `not_found` | 404 | Product or variant ID missing or in another workspace. |
| `conflict` | 409 | Archive with live stock; duplicate `ExternalRef`+`ExternalSource`. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:product:write`. |

Full mechanics: [**Errors**](/docs/sdk/go/errors).

## Next

- [**Stock**](/docs/sdk/go/resources/stock) &mdash; per-variant per-warehouse inventory.
- [**Licenses**](/docs/sdk/go/resources/licenses) &mdash; digital-product license keys.
- [**API &rarr; Products**](/docs/api/resources/products) &mdash; HTTP-level reference.
