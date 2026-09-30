---
title: Billing
---

# Billing

The `billing` namespace is the **merchant's subscription to Fulkruma itself** &mdash; not the merchant's billing of their own end customers. Read plans, the current plan and subscription, usage, and invoices; start a hosted checkout to upgrade; cancel. Under the hood this is all powered by Plugipay (Pattern 2 partner-billing), but the SDK exposes a flat surface. For wire shapes, see [**API &rarr; Billing**](/docs/api/resources/billing).

## Field on the Client

`client.Billing` &mdash; type `*fulkruma.BillingResource`. Seven methods: five reads, a checkout and a cancel. There's no "upgrade in place" &mdash; every plan change goes through `Checkout`, which returns a hosted Plugipay URL.

## Methods

### Plans

**Signature.** `func (r *BillingResource) Plans(ctx context.Context) ([]map[string]any, error)`

Every plan Fulkruma offers: `free`, `starter`, `growth`, `scale`. Each has an `id`, `name`, `price` (in IDR), `currency` (`"IDR"`) and `features` (display strings). No credentials needed.

```go
plans, err := client.Billing.Plans(ctx)
for _, p := range plans {
    fmt.Printf("%v — Rp%v/month\n", p["name"], p["price"])
}
```

### CurrentPlan

**Signature.** `func (r *BillingResource) CurrentPlan(ctx context.Context) (map[string]any, error)`

The workspace's plan and its limits: `plan`, `planName`, `ordersLimit`, `warehousesLimit`, `licenseKeysLimit`, `apiKeysLimit`, `webhookEndpointsLimit`, `rateLimit`, `biteshipShipmentsLimit` (each `-1` for unlimited) and `billingCycleEnd`.

### Subscription

**Signature.** `func (r *BillingResource) Subscription(ctx context.Context) (map[string]any, error)`

The subscription's state: `plan`, `planName`, `status` (lowercase: `active`, `canceling`, …), `currentPeriodStart`, `currentPeriodEnd`, `cancelAt`.

```go
sub, err := client.Billing.Subscription(ctx)
if err == nil && sub["status"] == "canceling" {
    showRenewBanner(sub["currentPeriodEnd"])
}
```

### Usage

**Signature.** `func (r *BillingResource) Usage(ctx context.Context) (map[string]any, error)`

This month's counters against the plan: `ordersFulfilled` / `ordersLimit`, `shipmentsCreated`, `licensesIssued`, and `resetAt` (the start of next month).

### Invoices

**Signature.** `func (r *BillingResource) Invoices(ctx context.Context, p BillingInvoicesParams) (*BillingInvoicesResult, error)`

Invoices for Fulkruma's own subscription, newest first. `Limit` defaults to 20, max 50. Pass the returned `Cursor` to get the next page while `HasMore`. Each invoice map has `id`, `plan`, `amount`, `currency`, `status`, `paidAt`, `receiptUrl`, `createdAt`.

```go
var cursor string
for {
    page, err := client.Billing.Invoices(ctx, fulkruma.BillingInvoicesParams{Limit: 50, Cursor: cursor})
    if err != nil {
        return err
    }
    for _, inv := range page.Data {
        fmt.Println(inv["id"], inv["amount"], inv["status"])
    }
    if !page.HasMore {
        break
    }
    cursor = page.Cursor
}
```

### Checkout

**Signature.** `func (r *BillingResource) Checkout(ctx context.Context, in BillingCheckoutInput) (*BillingCheckoutResult, error)`

Starts a Plugipay subscription for the plan and returns the hosted page where the first payment is made. `Plan` is `"STARTER"`, `"GROWTH"` or `"SCALE"`. `Email` is **required** when you call with an API key (a key has no email of its own). `Currency` (`"IDR"` or `"USD"`) defaults by the caller's country &mdash; IDR in Indonesia, USD elsewhere.

```go
result, err := client.Billing.Checkout(ctx, fulkruma.BillingCheckoutInput{
    Plan:  "GROWTH",
    Email: "owner@your-store.example",
})
if err != nil {
    return err
}
// Redirect the merchant's browser to result.CheckoutURL
```

The hosted page handles card capture, 3DS and the partner-billing routing back to Fulkruma. When the invoice is paid, Plugipay notifies Fulkruma and the plan changes.

### Cancel

**Signature.** `func (r *BillingResource) Cancel(ctx context.Context) (map[string]any, error)`

Cancels the subscription **at period end** &mdash; the merchant keeps the plan until the current period closes. The request carries no body; the result is the updated subscription (as `Subscription` returns it, with `status` `"canceling"`). A workspace with no paid subscription gets its current state back unchanged.

## Types

```go
type BillingInvoicesParams struct {
    Limit  int    // default 20, max 50
    Cursor string // from the previous page
}

type BillingInvoicesResult struct {
    Data    []map[string]any `json:"data"`
    Cursor  string           `json:"cursor"`
    HasMore bool             `json:"hasMore"`
}

type BillingCheckoutInput struct {
    Plan     string `json:"plan"`               // STARTER | GROWTH | SCALE
    Email    string `json:"email,omitempty"`    // required for an API-key caller
    Name     string `json:"name,omitempty"`
    Currency string `json:"currency,omitempty"` // IDR | USD
}

type BillingCheckoutResult struct {
    SubscriptionID    string `json:"subscriptionId"`
    InvoiceID         string `json:"invoiceId"`
    CheckoutSessionID string `json:"checkoutSessionId"`
    CheckoutURL       string `json:"checkoutUrl"`
}
```

## Common patterns

### Render a billing dashboard

```go
func billingDashboard(ctx context.Context, c *fulkruma.Client) (map[string]any, error) {
    current, err := c.Billing.CurrentPlan(ctx)
    if err != nil {
        return nil, err
    }
    sub, err := c.Billing.Subscription(ctx)
    if err != nil {
        return nil, err
    }
    usage, err := c.Billing.Usage(ctx)
    if err != nil {
        return nil, err
    }
    return map[string]any{"current": current, "subscription": sub, "usage": usage}, nil
}
```

### Upgrade flow

```go
func upgradeTo(ctx context.Context, c *fulkruma.Client, plan, ownerEmail string) (string, error) {
    result, err := c.Billing.Checkout(ctx, fulkruma.BillingCheckoutInput{Plan: plan, Email: ownerEmail})
    if err != nil {
        return "", err
    }
    return result.CheckoutURL, nil // your handler redirects here
}
```

Fulkruma sends no webhook event for plan changes; re-read `Subscription` when the merchant comes back from the hosted page.

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `VALIDATION` | 400 | `Plan` not one of `STARTER` / `GROWTH` / `SCALE`, a malformed `Email`, or no email at all for an API-key caller. |
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |
| `CHECKOUT_FAILED` | 500 | Plugipay refused to start the subscription. |
| `CANCEL_FAILED` | 500 | Plugipay refused the cancellation. |
| `PLAN_NOT_CONFIGURED` | 503 | The plan has no Plugipay price set up yet. |

## Next

- [**Integrations**](/docs/sdk/go/resources/integrations) &mdash; check the Plugipay link status if billing isn't working.
- [**API &rarr; Billing**](/docs/api/resources/billing) &mdash; HTTP reference.
