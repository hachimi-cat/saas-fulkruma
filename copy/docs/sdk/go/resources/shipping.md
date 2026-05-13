---
title: Shipping
---

# Shipping

The `shipping` namespace is everything you need **before** booking a shipment: list available couriers, configure the workspace's default origin, and quote rates. It's intentionally separate from `shipments` &mdash; the latter mutates state, this one is mostly read-only metadata. The Go SDK exposes four methods behind `client.Shipping`. For wire shapes, see [**API &rarr; Shipping**](/docs/api/resources/shipping).

## Field on the Client

`client.Shipping` &mdash; type `*fulkruma.ShippingResource`. Four methods. Three reads, one config mutation (`SetOrigin`). Methods that return `map[string]any` are intentionally loosely typed because the upstream courier API (Biteship today) controls the shape.

## Methods

### Couriers

**Signature.** `func (r *ShippingResource) Couriers(ctx context.Context) ([]map[string]any, error)`

Returns the list of couriers available in the workspace, with their service codes (e.g. JNE `reg`, JNE `yes`, J&T `ez`). The shape passes through whatever Biteship returns &mdash; wrap in your own typed adapter if you depend on specific fields.

```go
couriers, err := client.Shipping.Couriers(ctx)
for _, c := range couriers {
    fmt.Println(c["courierCode"], c["courierName"])
}
```

The list is keyed off the merchant's enabled couriers in the portal &mdash; if a courier isn't there, enable it in the dashboard first.

### Origin and SetOrigin

**Signature.**
- `func (r *ShippingResource) Origin(ctx context.Context) (map[string]any, error)`
- `func (r *ShippingResource) SetOrigin(ctx context.Context, in map[string]any) (map[string]any, error)`

The workspace's default origin &mdash; pickup location, sender contact, area code &mdash; used when a shipment doesn't explicitly include an `Origin`. Read via `Origin()`, write via `SetOrigin()`.

```go
current, err := client.Shipping.Origin(ctx)

_, err = client.Shipping.SetOrigin(ctx, map[string]any{
    "contactName":  "Warehouse Manager",
    "contactPhone": "+62211234567",
    "address":      "Jl. Sudirman No. 1",
    "postalCode":   "12190",
    "areaId":       "IDN-JKT-CTL",
    "lat":          -6.2088,
    "lng":          106.8456,
})
```

The default origin is what `Shipments.Create` with `Origin: {"warehouseId": "..."}` resolves against when a warehouse doesn't have its own address on file. If every warehouse you have is fully populated, you can ignore the workspace-level origin.

### Rates

**Signature.** `func (r *ShippingResource) Rates(ctx context.Context, in ShippingRatesInput) (map[string]any, error)`

The most-used method on this namespace. Posts a destination + line items + (optional) insurance flag, returns a list of `{courierCode, courierServiceCode, courierType, price, etd, ...}` &mdash; one per (courier, service) combination. Quotes are live (round-tripped through Biteship) and valid for a short window.

```go
insurance := true
quote, err := client.Shipping.Rates(ctx, fulkruma.ShippingRatesInput{
    Destination: map[string]any{
        "areaId":     "IDN-JKT-MTH",
        "postalCode": "10310",
    },
    Items: []map[string]any{
        {"variantId": "var_01HX...", "quantity": 2, "weight": 0.5},
    },
    Insurance: &insurance,
})
if err != nil {
    return err
}

ratesList, _ := quote["rates"].([]any)
for _, r := range ratesList {
    rm := r.(map[string]any)
    fmt.Printf("%v/%v: Rp%v (ETD %v)\n",
        rm["courierCode"], rm["courierServiceCode"], rm["price"], rm["etd"])
}
```

The same `courierCode`/`courierServiceCode`/`price` triple is what you pass to [`Shipments.Create`](/docs/sdk/go/resources/shipments) once the customer picks one.

## Types

```go
type ShippingRatesInput struct {
    Destination map[string]any   `json:"destination"`
    Items       []map[string]any `json:"items"`
    Insurance   *bool            `json:"insurance,omitempty"`
}
```

Methods return `map[string]any` for forward compatibility with new courier fields. Fields we promise across courier providers:

- `rates[].courierCode` &mdash; matches what `Shipments.Create` expects
- `rates[].courierServiceCode`
- `rates[].courierType`
- `rates[].price` (numeric)
- `rates[].etd` (estimated delivery, vendor-specific format)

See [**API &rarr; Shipping**](/docs/api/resources/shipping) for the full per-provider field map.

## Common patterns

### Quote, render, book

The canonical pattern &mdash; user picks from a list of quotes, then you book:

```go
func quoteForCheckout(ctx context.Context, c *fulkruma.Client, dest map[string]any, items []map[string]any) ([]any, error) {
    quote, err := c.Shipping.Rates(ctx, fulkruma.ShippingRatesInput{
        Destination: dest,
        Items:       items,
    })
    if err != nil {
        return nil, err
    }
    ratesList, _ := quote["rates"].([]any)
    return ratesList, nil
}
```

The book half lives in [`Shipments.Create`](/docs/sdk/go/resources/shipments).

### Cache courier list per process

`Shipping.Couriers()` is workspace-scoped config that rarely changes:

```go
var (
    couriersOnce  sync.Once
    couriersCache []map[string]any
    couriersErr   error
)

func getCouriers(ctx context.Context, c *fulkruma.Client) ([]map[string]any, error) {
    couriersOnce.Do(func() {
        couriersCache, couriersErr = c.Shipping.Couriers(ctx)
    })
    return couriersCache, couriersErr
}
```

Invalidate on a `fulkruma.integration.biteship.updated` webhook if you need to be fully reactive; in practice, restart-on-deploy is fine.

### Initial setup: configure origin once

For a fresh workspace, you'll typically call `SetOrigin` exactly once at onboarding time:

```go
_, err := client.Shipping.SetOrigin(ctx, map[string]any{
    "contactName":  "Fulfillment",
    "contactPhone": "+62211234567",
    "address":      "Jl. Sudirman No. 1, Jakarta",
    "postalCode":   "12190",
    "areaId":       "IDN-JKT-CTL",
})
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Bad `areaId`, missing `weight` on items. |
| `not_found` | 404 | Variant in `Items` doesn't exist. |
| `courier_error` | 502 | Upstream Biteship rejected the rate request. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:shipping:read` / `:write`. |

`courier_error` is the retry candidate &mdash; transient blips at the courier aggregator are the most common failure mode.

## Next

- [**Shipments**](/docs/sdk/go/resources/shipments) &mdash; the other side of the quote-then-book flow.
- [**Addresses**](/docs/sdk/go/resources/addresses) &mdash; destinations to quote against.
- [**API &rarr; Shipping**](/docs/api/resources/shipping) &mdash; HTTP-level reference.
