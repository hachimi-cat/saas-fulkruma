---
title: Warehouses
---

# Warehouses

A **warehouse** is a physical (or logical) location stock lives at &mdash; every `VariantStock` row pins to one warehouse + one variant, every `Shipment` has an origin warehouse, and the routing engine picks a warehouse per order based on availability + proximity. The Go SDK exposes the four warehouse endpoints behind `client.Warehouses`; every method takes `context.Context` first and returns either `(*fulkruma.Warehouse, error)` or `([]fulkruma.Warehouse, error)`. For wire shapes and the full field table, see [**API &rarr; Warehouses**](/docs/api/resources/warehouses).

## Field on the Client

`client.Warehouses` &mdash; type `*fulkruma.WarehousesResource`. Installed on the `*Client` returned by `NewClient`; shares the same `*http.Client`, base URL, key, and `OnBehalfOf` default as the parent. No per-namespace state &mdash; methods are safe to call concurrently from many goroutines.

## Methods

### Create

**Signature.** `func (r *WarehousesResource) Create(ctx context.Context, in WarehouseCreateInput) (*Warehouse, error)`

Creates a warehouse. Only `Name` is required &mdash; everything else (`Address`, `City`, `Postal`, `Lat`, `Lng`, `Phone`, `IsDefault`) is optional. The SDK does **not** auto-mint an `Idempotency-Key` here; warehouse creation is naturally non-idempotent and rarely retried.

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

lat, lng := -6.2088, 106.8456
isDefault := true

wh, err := client.Warehouses.Create(ctx, fulkruma.WarehouseCreateInput{
    Name:      "Jakarta DC-1",
    Address:   "Jl. Sudirman No. 1",
    City:      "Jakarta",
    Postal:    "12190",
    Lat:       &lat,
    Lng:       &lng,
    Phone:     "+62211234567",
    IsDefault: &isDefault,
})
if err != nil {
    return err
}
log.Printf("created %s", wh.ID)   // "wh_01HXAB..."
```

<blockquote class="callout-note">

**Only one default per workspace.** Setting `IsDefault: &true` clears the flag on whichever warehouse currently holds it &mdash; the backend does the swap inside a single transaction.

</blockquote>

### List

**Signature.** `func (r *WarehousesResource) List(ctx context.Context) ([]Warehouse, error)`

Returns every warehouse in the workspace, including archived ones. Filter on `ArchivedAt` to find active. **Not paginated** &mdash; we expect single-digit warehouse counts per merchant.

```go
warehouses, err := client.Warehouses.List(ctx)
if err != nil {
    return err
}
for _, w := range warehouses {
    if w.ArchivedAt == nil {
        fmt.Println(w.ID, w.Name, deref(w.City))
    }
}
```

### Update

**Signature.** `func (r *WarehousesResource) Update(ctx context.Context, id string, patch WarehouseUpdateInput) (*Warehouse, error)`

`PATCH` semantics &mdash; only fields you set on the pointer-heavy `WarehouseUpdateInput` are touched. Promote with `IsDefault: &true`; the API clears the flag on the previous default in the same transaction.

```go
newPhone := "+62217654321"
newLat, newLng := -6.2090, 106.8460

wh, err := client.Warehouses.Update(ctx, id, fulkruma.WarehouseUpdateInput{
    Phone: &newPhone,
    Lat:   &newLat,
    Lng:   &newLng,
})
```

### Archive

**Signature.** `func (r *WarehousesResource) Archive(ctx context.Context, id string) (bool, error)`

Soft-delete. The warehouse stays referenceable from historic shipments and stock movements; it no longer shows up in the routing pool. **Not reversible** via the API &mdash; mint a new warehouse if you need to "un-archive".

```go
ok, err := client.Warehouses.Archive(ctx, id)
if err != nil {
    var pe *fulkruma.Error
    if errors.As(err, &pe) && pe.Code == "conflict" {
        // warehouse still has live stock — zero it out first via stock.Adjust
        return err
    }
    return err
}
_ = ok
```

## Types

```go
type Warehouse struct {
    ID         string   `json:"id"`         // "wh_..."
    AccountID  string   `json:"accountId"`
    Name       string   `json:"name"`
    Address    *string  `json:"address"`
    City       *string  `json:"city"`
    Postal     *string  `json:"postal"`
    Lat        *float64 `json:"lat"`
    Lng        *float64 `json:"lng"`
    Phone      *string  `json:"phone"`
    IsDefault  bool     `json:"isDefault"`
    ArchivedAt *string  `json:"archivedAt"`
    CreatedAt  string   `json:"createdAt"`
    UpdatedAt  string   `json:"updatedAt"`
}

type WarehouseCreateInput struct {
    Name      string   `json:"name"`
    Address   string   `json:"address,omitempty"`
    City      string   `json:"city,omitempty"`
    Postal    string   `json:"postal,omitempty"`
    Lat       *float64 `json:"lat,omitempty"`
    Lng       *float64 `json:"lng,omitempty"`
    Phone     string   `json:"phone,omitempty"`
    IsDefault *bool    `json:"isDefault,omitempty"`
}

type WarehouseUpdateInput struct {
    Name      *string  `json:"name,omitempty"`
    Address   *string  `json:"address,omitempty"`
    // ... all pointer fields, see resources.go for the full list
}
```

Pointer fields are nullable on the wire. A small helper:

```go
func deref(s *string) string {
    if s == nil { return "" }
    return *s
}
```

For per-field validation rules, see [**API &rarr; Warehouses**](/docs/api/resources/warehouses).

## Common patterns

### Bootstrap a default warehouse

```go
func ensureDefault(ctx context.Context, c *fulkruma.Client, name string) (*fulkruma.Warehouse, error) {
    warehouses, err := c.Warehouses.List(ctx)
    if err != nil {
        return nil, err
    }
    var active []fulkruma.Warehouse
    for _, w := range warehouses {
        if w.ArchivedAt == nil {
            active = append(active, w)
        }
    }
    if len(active) == 0 {
        isDefault := true
        return c.Warehouses.Create(ctx, fulkruma.WarehouseCreateInput{
            Name: name, IsDefault: &isDefault,
        })
    }
    for _, w := range active {
        if w.IsDefault {
            return &w, nil
        }
    }
    isDefault := true
    return c.Warehouses.Update(ctx, active[0].ID, fulkruma.WarehouseUpdateInput{
        IsDefault: &isDefault,
    })
}
```

### Resolve a warehouse by city

```go
func warehouseForCity(ctx context.Context, c *fulkruma.Client, city string) (*fulkruma.Warehouse, error) {
    warehouses, err := c.Warehouses.List(ctx)
    if err != nil {
        return nil, err
    }
    var match *fulkruma.Warehouse
    for i, w := range warehouses {
        if w.ArchivedAt != nil || w.City == nil || !strings.EqualFold(*w.City, city) {
            continue
        }
        if match == nil || w.IsDefault {
            match = &warehouses[i]
        }
    }
    return match, nil
}
```

### Cancellation-aware lookup

```go
ctx, cancel := context.WithTimeout(parentCtx, 2*time.Second)
defer cancel()
warehouses, err := client.Warehouses.List(ctx)  // returns timeout if slow
```

If the parent context is canceled, the SDK aborts the in-flight request and returns an error with `Status: 0`.

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Missing `Name`, bad coordinate range, postal too long. |
| `not_found` | 404 | Warehouse ID doesn't exist or in another workspace. |
| `conflict` | 409 | Archive attempted on a warehouse with live stock. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:warehouse:write`. |

Branch with `errors.As`:

```go
var pe *fulkruma.Error
if errors.As(err, &pe) {
    switch pe.Code {
    case "conflict":     /* live stock */
    case "not_found":    /* missing id */
    case "validation_error":
        log.Printf("bad input: %s (requestId=%s)", pe.Message, pe.RequestID)
    }
}
```

Full mechanics: [**Errors**](/docs/sdk/go/errors).

## Next

- [**Stock**](/docs/sdk/go/resources/stock) &mdash; what lives in a warehouse.
- [**Shipments**](/docs/sdk/go/resources/shipments) &mdash; what leaves a warehouse.
- [**API &rarr; Warehouses**](/docs/api/resources/warehouses) &mdash; HTTP-level reference.
