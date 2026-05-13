---
title: Stock
---

# Stock

**Stock** is the per-variant, per-warehouse inventory ledger. Every variant has zero or more `VariantStock` rows (one per warehouse it lives at), and every change generates a `StockMovement` audit record. Reservations are short-lived holds that block checkout-bound inventory from being double-sold. The Go SDK exposes four methods behind `client.Stock`. For wire shapes, see [**API &rarr; Stock**](/docs/api/resources/stock).

## Field on the Client

`client.Stock` &mdash; type `*fulkruma.StockResource`. Three reads + one mutation (`Adjust`) &mdash; the only way to change stock from the SDK. Reservations are created server-side by checkout sessions; movements are append-only.

## Methods

### Levels

**Signature.** `func (r *StockResource) Levels(ctx context.Context, variantID string) ([]VariantStock, error)`

Returns current on-hand and available levels for every (variant, warehouse) pair. Pass `""` to read across all variants, or a `var_*` ID to scope.

```go
stock, err := client.Stock.Levels(ctx, "var_01HX...")
if err != nil {
    return err
}
for _, s := range stock {
    fmt.Printf("%s: %d available (%d on hand, %d reserved)\n",
        s.WarehouseID, s.Available, s.OnHand, s.Reserved)
}
```

`Available == OnHand - Reserved` always &mdash; the server keeps this invariant inside the same transaction as every stock mutation, so you'll never see drift.

### Movements

**Signature.** `func (r *StockResource) Movements(ctx context.Context, variantID string) ([]StockMovement, error)`

Returns the append-only ledger &mdash; every adjust, every checkout-driven reservation/release, every shipment-driven decrement. Default page is the most recent 100 movements.

```go
movements, err := client.Stock.Movements(ctx, "var_01HX...")
for _, m := range movements {
    fmt.Println(m.CreatedAt, m.Reason, m.Delta)
}
```

Reasons: `purchase`, `sale`, `return`, `damage`, `audit`, `transfer_in`, `transfer_out`, `manual_adjust`.

### Reservations

**Signature.** `func (r *StockResource) Reservations(ctx context.Context) ([]StockReservation, error)`

Returns currently-live reservations across the workspace. Reservations expire automatically after `ExpiresAt` &mdash; the cleanup job releases them back to `Available`. You normally read this for debugging "why is X showing 0 available when nothing's been sold?".

```go
reservations, err := client.Stock.Reservations(ctx)
fmt.Println(len(reservations), "live holds")
```

### Adjust

**Signature.** `func (r *StockResource) Adjust(ctx context.Context, in StockAdjustInput) (*StockAdjustResult, error)`

The one mutation. Atomically updates the `(variant, warehouse)` row by `Delta` and writes a `StockMovement` audit entry in the same transaction. The SDK auto-mints an `Idempotency-Key` &mdash; replay-safe under network retries.

```go
result, err := client.Stock.Adjust(ctx, fulkruma.StockAdjustInput{
    VariantID:   "var_01HX...",
    WarehouseID: "wh_01HX...",
    Delta:       50,                    // positive = receive, negative = take out
    Reason:      fulkruma.StockReasonPurchase,
    Note:        "PO-2026-118 received",
})
if err != nil {
    return err
}
fmt.Println("on hand now:", result.Stock.OnHand)
fmt.Println("movement id:", result.Movement.ID)
```

<blockquote class="callout-warn">

**Negative deltas can't take `Available` below zero.** If you try to subtract more than is currently free, the API returns `*fulkruma.Error{Status: 409, Code: "insufficient_stock"}` and rolls back &mdash; neither the row nor the movement is written. Use `Levels` first if you need to clamp.

</blockquote>

## Types

```go
type VariantStock struct {
    ID                string `json:"id"`
    VariantID         string `json:"variantId"`
    WarehouseID       string `json:"warehouseId"`
    OnHand            int64  `json:"onHand"`
    Reserved          int64  `json:"reserved"`
    Available         int64  `json:"available"`        // OnHand - Reserved
    LowStockThreshold *int64 `json:"lowStockThreshold"`
    UpdatedAt         string `json:"updatedAt"`
}

type StockMovement struct {
    ID            string              `json:"id"`
    VariantID     string              `json:"variantId"`
    WarehouseID   string              `json:"warehouseId"`
    Delta         int64               `json:"delta"`         // signed
    Reason        StockMovementReason `json:"reason"`
    Note          *string             `json:"note"`
    ReferenceType *string             `json:"referenceType"` // "shipment" | "checkout"
    ReferenceID   *string             `json:"referenceId"`
    CreatedAt     string              `json:"createdAt"`
}

type StockReservation struct {
    ID                string `json:"id"`
    VariantID         string `json:"variantId"`
    WarehouseID       string `json:"warehouseId"`
    Quantity          int64  `json:"quantity"`
    CheckoutSessionID *string `json:"checkoutSessionId"`
    ExpiresAt         string `json:"expiresAt"`
    CreatedAt         string `json:"createdAt"`
}

type StockMovementReason string

const (
    StockReasonPurchase     StockMovementReason = "purchase"
    StockReasonSale         StockMovementReason = "sale"
    StockReasonReturn       StockMovementReason = "return"
    StockReasonDamage       StockMovementReason = "damage"
    StockReasonAudit        StockMovementReason = "audit"
    StockReasonTransferIn   StockMovementReason = "transfer_in"
    StockReasonTransferOut  StockMovementReason = "transfer_out"
    StockReasonManualAdjust StockMovementReason = "manual_adjust"
)
```

## Common patterns

### Stock a brand-new variant

```go
_, err := client.Stock.Adjust(ctx, fulkruma.StockAdjustInput{
    VariantID:   "var_01HX...",
    WarehouseID: "wh_01HX...",
    Delta:       100,
    Reason:      fulkruma.StockReasonPurchase,
    Note:        "Initial stock",
})
```

### Transfer between warehouses

Two adjusts &mdash; out first, in second:

```go
func transferStock(ctx context.Context, c *fulkruma.Client, variantID, fromWh, toWh string, qty int64) error {
    if _, err := c.Stock.Adjust(ctx, fulkruma.StockAdjustInput{
        VariantID: variantID, WarehouseID: fromWh,
        Delta: -qty, Reason: fulkruma.StockReasonTransferOut,
    }); err != nil {
        return err
    }
    _, err := c.Stock.Adjust(ctx, fulkruma.StockAdjustInput{
        VariantID: variantID, WarehouseID: toWh,
        Delta: qty, Reason: fulkruma.StockReasonTransferIn,
    })
    return err
}
```

If the first succeeds and the second fails, you have a real problem &mdash; wrap with your own job-runner retry, and keep the originating ref via `Note` so you can reconcile manually.

### Audit count

Daily reconciliation against your WMS:

```go
func reconcile(ctx context.Context, c *fulkruma.Client, variantID, warehouseID string, counted int64) error {
    stock, err := c.Stock.Levels(ctx, variantID)
    if err != nil {
        return err
    }
    var row *fulkruma.VariantStock
    for i, s := range stock {
        if s.WarehouseID == warehouseID {
            row = &stock[i]
            break
        }
    }
    if row == nil {
        return nil
    }
    delta := counted - row.OnHand
    if delta == 0 {
        return nil
    }
    _, err = c.Stock.Adjust(ctx, fulkruma.StockAdjustInput{
        VariantID:   variantID,
        WarehouseID: warehouseID,
        Delta:       delta,
        Reason:      fulkruma.StockReasonAudit,
    })
    return err
}
```

### Detect low-stock variants

```go
func lowStock(ctx context.Context, c *fulkruma.Client) ([]fulkruma.VariantStock, error) {
    stock, err := c.Stock.Levels(ctx, "")
    if err != nil {
        return nil, err
    }
    var low []fulkruma.VariantStock
    for _, s := range stock {
        if s.LowStockThreshold != nil && s.Available <= *s.LowStockThreshold {
            low = append(low, s)
        }
    }
    return low, nil
}
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Missing `VariantID`/`WarehouseID`, bad `Reason`, non-integer `Delta`. |
| `not_found` | 404 | Variant or warehouse ID missing or in another workspace. |
| `insufficient_stock` | 409 | Negative delta would take `Available` below zero. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:stock:write`. |

## Next

- [**Shipments**](/docs/sdk/go/resources/shipments) &mdash; outbound stock movements with carriers attached.
- [**Warehouses**](/docs/sdk/go/resources/warehouses) &mdash; where stock lives.
- [**API &rarr; Stock**](/docs/api/resources/stock) &mdash; HTTP-level reference.
