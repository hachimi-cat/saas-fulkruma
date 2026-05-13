---
title: Deliveries
---

# Deliveries

A **delivery** is the digital-fulfilment counterpart to a shipment. Where a shipment hands a parcel to a courier, a delivery hands a download link to a buyer of a `Type: ProductTypeDigital` product. Each delivery has a max download count, an expiry, and an event trail. The Go SDK exposes three methods behind `client.Deliveries`. For wire shapes, see [**API &rarr; Deliveries**](/docs/api/resources/deliveries).

## Field on the Client

`client.Deliveries` &mdash; type `*fulkruma.DeliveriesResource`. Three methods. There's no `Update` (delivery terms are immutable after issuance) and no `Revoke` &mdash; the closest thing to "revoke" is letting the delivery expire, or revoking the underlying license via `Licenses.Revoke` if the product is license-gated.

## Methods

### Create

**Signature.** `func (r *DeliveriesResource) Create(ctx context.Context, in DeliveryCreateInput) (*Delivery, error)`

Issues a delivery. Pass the product, the customer, the checkout session it came from, and optionally a download cap and expiry. The SDK auto-mints an `Idempotency-Key`.

```go
maxDl := int64(5)
expires := time.Now().AddDate(0, 0, 30).UTC().Format(time.RFC3339)

delivery, err := client.Deliveries.Create(ctx, fulkruma.DeliveryCreateInput{
    ProductID:         "prod_01HX...",
    CustomerID:        "cus_01HX...",
    CheckoutSessionID: "cs_01HX...",
    MaxDownloads:      &maxDl,
    ExpiresAt:         expires,
    ExternalSource:    "storlaunch",
    ExternalRef:       "order-118-dl-1",
})
if err != nil {
    return err
}
log.Printf("issued %s url=%v", delivery.ID, delivery.DownloadURL)
```

`MaxDownloads` defaults to whatever the product configures (or unlimited if neither sets one). `ExpiresAt` defaults to 30 days.

<blockquote class="callout-note">

**The `DownloadURL` is signed and short-lived.** It carries an embedded HMAC and expires after a few minutes. Email it to the buyer directly; don't cache it in your own system. Re-fetching via `Deliveries.Get` returns a freshly-signed URL each time.

</blockquote>

### Get

**Signature.** `func (r *DeliveriesResource) Get(ctx context.Context, id string) (*Delivery, error)`

Fetches one delivery by `del_*` ID. Returns a fresh signed `DownloadURL` and the latest download-count metrics.

```go
delivery, err := client.Deliveries.Get(ctx, "del_01HX...")
limit := "∞"
if delivery.MaxDownloads != nil {
    limit = fmt.Sprintf("%d", *delivery.MaxDownloads)
}
fmt.Printf("%d/%s downloads used\n", delivery.DownloadCount, limit)
```

### List

**Signature.** `func (r *DeliveriesResource) List(ctx context.Context) ([]Delivery, error)`

Returns every delivery in the workspace, freshest first. Not paginated.

```go
deliveries, err := client.Deliveries.List(ctx)
now := time.Now().UTC()
var expired []fulkruma.Delivery
for _, d := range deliveries {
    if d.ExpiresAt != nil {
        if t, err := time.Parse(time.RFC3339, *d.ExpiresAt); err == nil && t.Before(now) {
            expired = append(expired, d)
        }
    }
}
```

## Types

```go
type Delivery struct {
    ID                string  `json:"id"`         // "del_..."
    AccountID         string  `json:"accountId"`
    ProductID         string  `json:"productId"`
    CustomerID        string  `json:"customerId"`
    CheckoutSessionID string  `json:"checkoutSessionId"`
    Status            string  `json:"status"`     // "pending" | "ready" | "delivered" | "expired"
    DownloadURL       *string `json:"downloadUrl"`
    DownloadCount     int64   `json:"downloadCount"`
    MaxDownloads      *int64  `json:"maxDownloads"`
    ExpiresAt         *string `json:"expiresAt"`
    ExternalSource    *string `json:"externalSource"`
    ExternalRef       *string `json:"externalRef"`
    CreatedAt         string  `json:"createdAt"`
    UpdatedAt         string  `json:"updatedAt"`
}
```

For per-field validation rules, see [**API &rarr; Deliveries**](/docs/api/resources/deliveries).

## Common patterns

### Issue on `plugipay.checkout.completed` webhook

The canonical flow:

```go
func onCheckoutCompleted(ctx context.Context, c *fulkruma.Client, session struct {
    ID, CustomerID, ProductID string
}) error {
    product, err := c.Products.Get(ctx, session.ProductID)
    if err != nil {
        return err
    }
    if product.Type != fulkruma.ProductTypeDigital {
        return nil
    }
    delivery, err := c.Deliveries.Create(ctx, fulkruma.DeliveryCreateInput{
        ProductID:         product.ID,
        CustomerID:        session.CustomerID,
        CheckoutSessionID: session.ID,
    })
    if err != nil {
        return err
    }
    return sendDownloadEmail(session.CustomerID, *delivery.DownloadURL)
}
```

If the product is `LicenseEnabled`, issue a license too (see [`Licenses.Issue`](/docs/sdk/go/resources/licenses)) and email both.

### Re-send a download link

```go
func resend(ctx context.Context, c *fulkruma.Client, deliveryID string) error {
    delivery, err := c.Deliveries.Get(ctx, deliveryID)
    if err != nil {
        return err
    }
    if delivery.ExpiresAt != nil {
        if t, _ := time.Parse(time.RFC3339, *delivery.ExpiresAt); t.After(time.Now()) {
            return sendDownloadEmail(delivery.CustomerID, *delivery.DownloadURL)
        }
    }
    // Expired — issue a new delivery off the same checkout session
    fresh, err := c.Deliveries.Create(ctx, fulkruma.DeliveryCreateInput{
        ProductID:         delivery.ProductID,
        CustomerID:        delivery.CustomerID,
        CheckoutSessionID: delivery.CheckoutSessionID,
    })
    if err != nil {
        return err
    }
    return sendDownloadEmail(fresh.CustomerID, *fresh.DownloadURL)
}
```

### Audit expired deliveries

```go
func expiredReport(ctx context.Context, c *fulkruma.Client) ([]fulkruma.Delivery, error) {
    deliveries, err := c.Deliveries.List(ctx)
    if err != nil {
        return nil, err
    }
    var expired []fulkruma.Delivery
    for _, d := range deliveries {
        if d.Status == "expired" {
            expired = append(expired, d)
        }
    }
    return expired, nil
}
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Missing required IDs, bad `ExpiresAt` format. |
| `not_found` | 404 | Product, customer, or checkout-session ID missing. |
| `product_not_digital` | 409 | Product is not `Type: ProductTypeDigital`. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:delivery:write`. |

Branch with `errors.As`:

```go
var pe *fulkruma.Error
if errors.As(err, &pe) {
    switch pe.Code {
    case "product_not_digital": /* not a digital product */
    case "not_found":           /* missing reference */
    }
}
```

## Next

- [**Licenses**](/docs/sdk/go/resources/licenses) &mdash; the activation-counted credential layer for digital products.
- [**Products**](/docs/sdk/go/resources/products) &mdash; how to flag a product as digital.
- [**API &rarr; Deliveries**](/docs/api/resources/deliveries) &mdash; HTTP-level reference.
