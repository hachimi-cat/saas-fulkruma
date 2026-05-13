---
title: Shipments
---

# Shipments

A **shipment** is the record of a parcel handed off to a courier. It carries the courier code + service code, the price the merchant was quoted, an origin + destination, and the items packed into it. Fulkruma wires this to Biteship (its first courier aggregator) and emits `fulkruma.shipment.*` webhooks as the carrier sends status updates. The Go SDK exposes three methods behind `client.Shipments`. For wire shapes, see [**API &rarr; Shipments**](/docs/api/resources/shipments).

## Field on the Client

`client.Shipments` &mdash; type `*fulkruma.ShipmentsResource`. Three methods. No `Update`, no `Cancel` &mdash; once a label is booked with a courier, mutation goes through the courier's portal (or a support ticket). The closest thing to "cancel" is the carrier's own cancellation event, surfaced as a `shipment.updated` webhook.

## Methods

### Create

**Signature.** `func (r *ShipmentsResource) Create(ctx context.Context, in ShipmentCreateInput) (*Shipment, error)`

Books a shipment with the chosen courier. The SDK auto-mints an `Idempotency-Key` &mdash; replay-safe, which matters because creating one twice means paying the courier twice.

```go
shipment, err := client.Shipments.Create(ctx, fulkruma.ShipmentCreateInput{
    CustomerID:         "cus_01HX...",
    CourierCode:        "jne",
    CourierServiceCode: "reg",
    CourierType:        "standard",
    Price:              18000,
    Origin: map[string]any{
        "warehouseId": "wh_01HX...",
    },
    Destination: map[string]any{
        "contactName":  "Alice Tan",
        "contactPhone": "+62812xxxxxxxx",
        "address":      "Jl. Diponegoro No. 5",
        "postalCode":   "10310",
        "areaId":       "IDN-JKT-MTH",
    },
    Items: []map[string]any{
        {"variantId": "var_01HX...", "quantity": 2, "weight": 0.3},
    },
})
if err != nil {
    return err
}
log.Printf("booked %s tracking=%v", shipment.ID, shipment.TrackingNumber)
```

`Origin` and `Destination` are intentionally loosely typed (`map[string]any`) &mdash; the backend validates the shape per courier. For warehouse-origin shipments, pass `{"warehouseId": "wh_..."}` and let the server resolve the address.

<blockquote class="callout-note">

**The `Price` you pass is what you charge the customer.** It must match (or exceed) the quote from `Shipping.Rates` for the same courier/service/destination. Fulkruma validates this server-side; below-quote returns `400 validation_error`.

</blockquote>

### Get

**Signature.** `func (r *ShipmentsResource) Get(ctx context.Context, id string) (*Shipment, error)`

Fetches one shipment by `ship_*` ID. Includes the latest tracking events embedded in the response.

```go
shipment, err := client.Shipments.Get(ctx, "ship_01HX...")
if err != nil {
    return err
}
fmt.Println(shipment.Status)            // "in_transit"
fmt.Println(len(shipment.Events))       // tracking events
```

`Get` is naturally idempotent &mdash; safe to retry on any transient failure.

### List

**Signature.** `func (r *ShipmentsResource) List(ctx context.Context, status string) ([]Shipment, error)`

Lists shipments in the workspace. Pass `""` for all, or one of: `"pending"`, `"confirmed"`, `"picked_up"`, `"in_transit"`, `"delivered"`, `"returned"`, `"cancelled"`.

```go
shipments, err := client.Shipments.List(ctx, "in_transit")
fmt.Printf("%d parcels currently moving\n", len(shipments))
```

Status filter is exact-match. There's no date filter at the SDK layer &mdash; use the `Webhooks.ListEvents` ledger if you need a time-bounded scan.

## Types

```go
type Shipment struct {
    ID                 string                   `json:"id"`         // "ship_..."
    AccountID          string                   `json:"accountId"`
    CustomerID         *string                  `json:"customerId"`
    CourierCode        string                   `json:"courierCode"`
    CourierServiceCode string                   `json:"courierServiceCode"`
    CourierType        string                   `json:"courierType"`
    Status             ShipmentStatus           `json:"status"`
    TrackingNumber     *string                  `json:"trackingNumber"`
    Price              float64                  `json:"price"`
    Insurance          *float64                 `json:"insurance"`
    Insured            bool                     `json:"insured"`
    Origin             map[string]any           `json:"origin"`
    Destination        map[string]any           `json:"destination"`
    Items              []map[string]any         `json:"items"`
    Events             []ShipmentEvent          `json:"events"`
    ExternalSource     *string                  `json:"externalSource"`
    ExternalRef        *string                  `json:"externalRef"`
    CreatedAt          string                   `json:"createdAt"`
    UpdatedAt          string                   `json:"updatedAt"`
}

type ShipmentStatus string

const (
    ShipmentStatusPending   ShipmentStatus = "pending"
    ShipmentStatusConfirmed ShipmentStatus = "confirmed"
    ShipmentStatusPickedUp  ShipmentStatus = "picked_up"
    ShipmentStatusInTransit ShipmentStatus = "in_transit"
    ShipmentStatusDelivered ShipmentStatus = "delivered"
    ShipmentStatusReturned  ShipmentStatus = "returned"
    ShipmentStatusCancelled ShipmentStatus = "cancelled"
)
```

For the full courier-code vocabulary and per-courier `Origin`/`Destination` schemas, see [**API &rarr; Shipments**](/docs/api/resources/shipments).

## Common patterns

### Quote-then-book

The robust pattern &mdash; quote first via `Shipping.Rates`, let the customer pick, then book:

```go
rates, err := client.Shipping.Rates(ctx, fulkruma.ShippingRatesInput{
    Destination: map[string]any{"areaId": "IDN-JKT-MTH", "postalCode": "10310"},
    Items:       []map[string]any{{"variantId": "var_01HX...", "quantity": 1, "weight": 0.5}},
})
if err != nil {
    return err
}
ratesList, _ := rates["rates"].([]any)
picked := ratesList[0].(map[string]any)   // user picked in your UI

shipment, err := client.Shipments.Create(ctx, fulkruma.ShipmentCreateInput{
    CustomerID:         "cus_01HX...",
    CourierCode:        picked["courierCode"].(string),
    CourierServiceCode: picked["courierServiceCode"].(string),
    CourierType:        picked["courierType"].(string),
    Price:              picked["price"].(float64),
    Origin:             map[string]any{"warehouseId": "wh_01HX..."},
    Destination: map[string]any{
        "areaId": "IDN-JKT-MTH", "postalCode": "10310",
        "contactName": "Alice", "contactPhone": "+62812xxxxxxxx",
        "address": "Jl. Diponegoro 5",
    },
    Items: []map[string]any{
        {"variantId": "var_01HX...", "quantity": 1, "weight": 0.5},
    },
})
```

### Track via webhook

Don't poll `Shipments.Get` in a loop &mdash; subscribe to `fulkruma.shipment.updated`:

```go
_, err := client.Webhooks.CreateEndpoint(ctx, fulkruma.WebhookEndpointCreateInput{
    URL: "https://your-app.example.com/webhooks/fulkruma",
    Events: []string{
        "fulkruma.shipment.updated",
        "fulkruma.shipment.delivered",
    },
})
```

Then verify + handle in your endpoint. See [**Verifying webhooks**](/docs/sdk/go/verifying-webhooks).

### Idempotent re-booking after partial failure

If the courier API timed out and you don't know whether the shipment was created, retry with the same `ExternalRef`:

```go
shipment, err := client.Shipments.Create(ctx, fulkruma.ShipmentCreateInput{
    // ...
    ExternalRef:    "order-2026-118",
    ExternalSource: "storlaunch",
})
```

The auto-generated idempotency key covers in-process retries; for cross-process replay use a stable `ExternalRef` and check `Shipments.List(ctx, "")` first.

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Missing courier fields, price below quote, bad destination shape. |
| `not_found` | 404 | Customer, warehouse, or variant ID missing. |
| `insufficient_stock` | 409 | Stock at the origin warehouse is exhausted. |
| `courier_error` | 502 | Upstream Biteship rejected the booking. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:shipment:write`. |

`courier_error` is the retry candidate &mdash; transient upstream blips are the most common failure mode.

## Next

- [**Shipping**](/docs/sdk/go/resources/shipping) &mdash; rate quotes + courier listing + origin config.
- [**Stock**](/docs/sdk/go/resources/stock) &mdash; the inventory shipments draw from.
- [**Webhooks**](/docs/sdk/go/resources/webhooks) &mdash; how to receive status events.
- [**API &rarr; Shipments**](/docs/api/resources/shipments) &mdash; HTTP-level reference.
