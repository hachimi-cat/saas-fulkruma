---
title: Addresses
---

# Addresses

An **address** is a shipping destination stored against a customer. Each customer can have many addresses (home, office, parent's place); one can be flagged `IsDefault` to pre-select in checkout. The Go SDK exposes three methods behind `client.Addresses`. For wire shapes, see [**API &rarr; Addresses**](/docs/api/resources/addresses).

## Field on the Client

`client.Addresses` &mdash; type `*fulkruma.AddressesResource`. Three methods. There's no `Update` &mdash; addresses are immutable after create (the data model treats edits as delete-then-create so historic shipments keep pointing to the address that was actually shipped to). There's no `Get(id)` &mdash; `List(ctx, customerID)` is the only read path.

## Methods

### List

**Signature.** `func (r *AddressesResource) List(ctx context.Context, customerID string) ([]CustomerAddress, error)`

Returns every address in the workspace. Pass `""` for all, or a `cus_*` ID to scope to one customer's address book.

```go
addresses, err := client.Addresses.List(ctx, "cus_01HX...")
var defaultAddr *fulkruma.CustomerAddress
for i, a := range addresses {
    if a.IsDefault {
        defaultAddr = &addresses[i]
        break
    }
}
```

Not paginated &mdash; we expect a handful of addresses per customer, not thousands.

### Create

**Signature.** `func (r *AddressesResource) Create(ctx context.Context, in AddressCreateInput) (*CustomerAddress, error)`

Creates an address. `CustomerID`, `Label`, `ContactName`, `ContactPhone`, and `Address` are required. `PostalCode` and `AreaID` are required for any address you'll actually ship to. The SDK does **not** auto-mint an `Idempotency-Key` &mdash; addresses can have legitimate duplicates.

```go
lat, lng := -6.2088, 106.8456
isDefault := true

addr, err := client.Addresses.Create(ctx, fulkruma.AddressCreateInput{
    CustomerID:   "cus_01HX...",
    Label:        "Home",
    ContactName:  "Alice Tan",
    ContactPhone: "+62812xxxxxxxx",
    Email:        "alice@example.com",
    Address:      "Jl. Diponegoro No. 5",
    PostalCode:   "10310",
    AreaID:       "IDN-JKT-MTH",
    Lat:          &lat,
    Lng:          &lng,
    IsDefault:    &isDefault,
})
```

Setting `IsDefault: &true` clears the flag on whichever address currently holds it &mdash; one default per customer, swap is transactional.

### Delete

**Signature.** `func (r *AddressesResource) Delete(ctx context.Context, id string) (bool, error)`

Hard-deletes an address. **Historic shipments keep pointing to a snapshot** stored on the shipment itself, so deletion doesn't break audit trails &mdash; the address just disappears from the customer's address book.

```go
ok, err := client.Addresses.Delete(ctx, "addr_01HX...")
```

## Types

```go
type CustomerAddress struct {
    ID           string   `json:"id"`         // "addr_..."
    AccountID    string   `json:"accountId"`
    CustomerID   string   `json:"customerId"`
    Label        string   `json:"label"`
    ContactName  string   `json:"contactName"`
    ContactPhone string   `json:"contactPhone"`
    Email        *string  `json:"email"`
    Address      string   `json:"address"`
    PostalCode   *string  `json:"postalCode"`
    AreaID       *string  `json:"areaId"`     // Biteship area code
    Lat          *float64 `json:"lat"`
    Lng          *float64 `json:"lng"`
    IsDefault    bool     `json:"isDefault"`
    CreatedAt    string   `json:"createdAt"`
}
```

For the full `AreaID` vocabulary (Biteship's area codes), see [**API &rarr; Addresses**](/docs/api/resources/addresses).

## Common patterns

### First-time setup with default flag

```go
func captureFirstAddress(ctx context.Context, c *fulkruma.Client, customerID string, in fulkruma.AddressCreateInput) (*fulkruma.CustomerAddress, error) {
    addresses, err := c.Addresses.List(ctx, customerID)
    if err != nil {
        return nil, err
    }
    isFirst := len(addresses) == 0
    in.CustomerID = customerID
    in.IsDefault = &isFirst
    return c.Addresses.Create(ctx, in)
}
```

### "Edit" via delete-then-create

The resource is immutable; the closest thing to "edit" is replace:

```go
func replaceAddress(ctx context.Context, c *fulkruma.Client, oldID, customerID string, fresh fulkruma.AddressCreateInput) (*fulkruma.CustomerAddress, error) {
    addresses, err := c.Addresses.List(ctx, customerID)
    if err != nil {
        return nil, err
    }
    var wasDefault bool
    for _, a := range addresses {
        if a.ID == oldID {
            wasDefault = a.IsDefault
            break
        }
    }
    if _, err := c.Addresses.Delete(ctx, oldID); err != nil {
        return nil, err
    }
    fresh.CustomerID = customerID
    fresh.IsDefault = &wasDefault
    return c.Addresses.Create(ctx, fresh)
}
```

### Default-address resolver

For routing a shipment when the caller didn't specify which address to ship to:

```go
func defaultAddress(ctx context.Context, c *fulkruma.Client, customerID string) (*fulkruma.CustomerAddress, error) {
    addresses, err := c.Addresses.List(ctx, customerID)
    if err != nil {
        return nil, err
    }
    for i, a := range addresses {
        if a.IsDefault {
            return &addresses[i], nil
        }
    }
    if len(addresses) > 0 {
        return &addresses[0], nil
    }
    return nil, nil
}
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Missing required fields, bad phone format, postal too long. |
| `not_found` | 404 | Customer or address ID missing. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:address:write`. |

Branch with `errors.As`:

```go
var pe *fulkruma.Error
if errors.As(err, &pe) {
    switch pe.Code {
    case "validation_error": log.Printf("bad input: %s", pe.Message)
    case "not_found":        /* customer or address missing */
    }
}
```

## Next

- [**Shipments**](/docs/sdk/go/resources/shipments) &mdash; addresses are the destination half of every parcel.
- [**Shipping**](/docs/sdk/go/resources/shipping) &mdash; rate quotes use the address `AreaID` and `PostalCode`.
- [**API &rarr; Addresses**](/docs/api/resources/addresses) &mdash; HTTP-level reference.
