---
title: Licenses
---

# Licenses

A **license** is an activation-counted credential for a `LicenseEnabled` product. Issue one per purchase; the buyer's software calls `Activate` to bind a device and `Validate` on each launch. Licenses pair with deliveries: the delivery hands over the bits, the license gates how many devices can run them. The Go SDK exposes six methods behind `client.Licenses`. For wire shapes, see [**API &rarr; Licenses**](/docs/api/resources/licenses).

## Field on the Client

`client.Licenses` &mdash; type `*fulkruma.LicensesResource`. The first three methods (`Issue`, `List`, `Revoke`) need the workspace HMAC key. The last three (`Activate`, `Deactivate`, `Validate`) are **public** &mdash; called by the licensed software on the buyer's machine, which doesn't have your secret. The SDK still attaches the HMAC header when configured to (it doesn't hurt), but the backend treats these routes as unauthenticated.

## Methods

### Issue

**Signature.** `func (r *LicensesResource) Issue(ctx context.Context, in LicenseIssueInput) (*License, error)`

Issues a license for a product + customer pair. Pass `MaxActivations` to cap how many devices can use the key. Pass `ExpiresAt` for a time-limited license. The SDK auto-mints an `Idempotency-Key`.

```go
maxAct := int64(3)
expires := time.Now().AddDate(1, 0, 0).UTC().Format(time.RFC3339)

license, err := client.Licenses.Issue(ctx, fulkruma.LicenseIssueInput{
    ProductID:      "prod_01HX...",
    CustomerID:     "cus_01HX...",
    MaxActivations: &maxAct,
    ExpiresAt:      expires,
    ExternalSource: "storlaunch",
    ExternalRef:    "order-118-license",
})
if err != nil {
    return err
}
log.Println(license.Key)   // "FULK-XXXX-XXXX-XXXX-XXXX"
```

The `Key` is generated server-side using a high-entropy alphabet and is the only thing the buyer's software ever sees.

### List

**Signature.** `func (r *LicensesResource) List(ctx context.Context) ([]License, error)`

Returns every license in the workspace. Not paginated.

```go
licenses, err := client.Licenses.List(ctx)
var active []fulkruma.License
for _, l := range licenses {
    if l.Status == "active" {
        active = append(active, l)
    }
}
```

### Revoke

**Signature.** `func (r *LicensesResource) Revoke(ctx context.Context, id string) (*License, error)`

Marks a license as revoked. Subsequent `Validate` calls return `Valid: false, Status: "revoked"`. There's no "un-revoke" &mdash; issue a fresh license to restore access.

```go
_, err := client.Licenses.Revoke(ctx, "lic_01HX...")
```

Revoke is the right tool for chargebacks, fraud, and refunds.

### Activate (public)

**Signature.** `func (r *LicensesResource) Activate(ctx context.Context, in LicenseActivateInput) (*LicenseActivateResult, error)`

Called by the buyer's software on first launch to bind a device. Pass the license `Key` and a stable `InstanceID`. Returns `AlreadyActive: true` if the pair is already registered &mdash; treat that as success, not error.

```go
result, err := client.Licenses.Activate(ctx, fulkruma.LicenseActivateInput{
    Key:        "FULK-XXXX-XXXX-XXXX-XXXX",
    InstanceID: "550e8400-e29b-41d4-a716-446655440000",
})
if err == nil && result.Activation.ID != "" {
    // success — cache locally
}
```

If the license already has `MaxActivations` instances registered, the call returns `*fulkruma.Error{Code: "max_activations_exceeded", Status: 409}`.

### Deactivate (public)

**Signature.** `func (r *LicensesResource) Deactivate(ctx context.Context, in LicenseActivateInput) (*LicenseDeactivateResult, error)`

Releases an instance &mdash; the user is uninstalling, or moving to a new device.

```go
result, err := client.Licenses.Deactivate(ctx, fulkruma.LicenseActivateInput{
    Key:        "FULK-XXXX-XXXX-XXXX-XXXX",
    InstanceID: "550e8400-e29b-41d4-a716-446655440000",
})
_ = result
```

### Validate (public)

**Signature.** `func (r *LicensesResource) Validate(ctx context.Context, p LicenseValidateParams) (*LicenseValidateResult, error)`

Called by licensed software on every launch (or periodically). Returns the current license state without binding a new activation.

```go
status, err := client.Licenses.Validate(ctx, fulkruma.LicenseValidateParams{
    Key:       "FULK-XXXX-XXXX-XXXX-XXXX",
    ProductID: "prod_01HX...",   // optional, lets the server confirm key matches product
})
if err != nil || !status.Valid {
    os.Exit(1)   // license invalid, bail
}
```

Reasons a license can be invalid: `revoked`, `expired`, `not_found`, `product_mismatch`.

## Types

```go
type License struct {
    ID             string  `json:"id"`         // "lic_..."
    AccountID      string  `json:"accountId"`
    ProductID      string  `json:"productId"`
    CustomerID     string  `json:"customerId"`
    Key            string  `json:"key"`
    Status         string  `json:"status"`     // "active" | "revoked" | "expired"
    Activations    int64   `json:"activations"`
    MaxActivations *int64  `json:"maxActivations"`
    ExpiresAt      *string `json:"expiresAt"`
    ExternalSource *string `json:"externalSource"`
    ExternalRef    *string `json:"externalRef"`
    CreatedAt      string  `json:"createdAt"`
    UpdatedAt      string  `json:"updatedAt"`
}

type LicenseActivation struct {
    ID             string  `json:"id"`
    LicenseID      string  `json:"licenseId"`
    InstanceID     string  `json:"instanceId"`
    ActivatedAt    string  `json:"activatedAt"`
    DeactivatedAt  *string `json:"deactivatedAt"`
}

type LicenseValidateResult struct {
    Valid          bool    `json:"valid"`
    Key            string  `json:"key"`
    Status         *string `json:"status"`
    ProductID      *string `json:"productId"`
    Activations    *int64  `json:"activations"`
    MaxActivations *int64  `json:"maxActivations"`
    ExpiresAt      *string `json:"expiresAt"`
}
```

## Common patterns

### Issue on purchase

Tied to a `plugipay.checkout.completed` webhook:

```go
func onCheckoutCompleted(ctx context.Context, c *fulkruma.Client, session struct {
    ID, CustomerID, ProductID string
}) error {
    product, err := c.Products.Get(ctx, session.ProductID)
    if err != nil {
        return err
    }
    if !product.LicenseEnabled {
        return nil
    }
    license, err := c.Licenses.Issue(ctx, fulkruma.LicenseIssueInput{
        ProductID:      product.ID,
        CustomerID:     session.CustomerID,
        ExternalRef:    session.ID,
        ExternalSource: "plugipay",
    })
    if err != nil {
        return err
    }
    return emailLicense(session.CustomerID, license.Key)
}
```

### Software-side validate-on-launch

Pseudo-Go for the buyer's app:

```go
// No secret needed for Validate/Activate/Deactivate. NewClient requires
// SOME credentials, so use the merchant's distributed pseudo keyId.
client, _ := fulkruma.NewClient(fulkruma.ClientOptions{
    KeyID:  "AKIAFULK_DIST",
    Secret: "unused-for-public-routes",
})

func startup(ctx context.Context, savedKey string) error {
    status, err := client.Licenses.Validate(ctx, fulkruma.LicenseValidateParams{
        Key: savedKey,
    })
    if err != nil || !status.Valid {
        return fmt.Errorf("license invalid")
    }
    // re-validate every hour via your own scheduler
    return nil
}
```

### Deactivate-on-uninstall

```go
_, _ = client.Licenses.Deactivate(ctx, fulkruma.LicenseActivateInput{
    Key:        savedKey,
    InstanceID: savedInstanceID,
})
```

This frees a slot so the user can re-activate on a new machine without hitting `max_activations_exceeded`.

### Bulk revoke for refund batch

```go
func revokeForRefunds(ctx context.Context, c *fulkruma.Client, ids []string) error {
    for _, id := range ids {
        if _, err := c.Licenses.Revoke(ctx, id); err != nil {
            return err
        }
    }
    return nil
}
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Missing required IDs, bad `ExpiresAt`. |
| `not_found` | 404 | License ID or `Key` missing or wrong workspace. |
| `max_activations_exceeded` | 409 | Activate against an already-full license. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:license:write` (on issue/revoke). |
| `product_not_licensed` | 400 | Issuing on a product where `LicenseEnabled = false`. |

## Next

- [**Deliveries**](/docs/sdk/go/resources/deliveries) &mdash; the download-link half of digital fulfillment.
- [**Products**](/docs/sdk/go/resources/products) &mdash; how to enable license-mode on a product.
- [**API &rarr; Licenses**](/docs/api/resources/licenses) &mdash; HTTP-level reference.
