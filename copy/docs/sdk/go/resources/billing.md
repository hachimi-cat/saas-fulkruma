---
title: Billing
---

# Billing

The `billing` namespace is the **merchant's subscription to Fulkruma itself** &mdash; not the merchant's billing of their own end customers. Read plans, the current subscription, usage, and invoices; redirect to a hosted checkout to upgrade; cancel. Under the hood this is all powered by Plugipay (Pattern 2 partner-billing), but the SDK exposes a flat surface. For wire shapes, see [**API &rarr; Billing**](/docs/api/resources/billing).

## Field on the Client

`client.Billing` &mdash; type `*fulkruma.BillingResource`. Seven methods. Six reads + cancel + a checkout-redirect builder. There's no "upgrade in place" &mdash; every plan change goes through `Checkout`, which returns a hosted URL on `pay.plugipay.com`.

## Methods

### Plans

**Signature.** `func (r *BillingResource) Plans(ctx context.Context) ([]map[string]any, error)`

Returns every plan Fulkruma offers. Each plan has an `id`, name, price, and feature/limit map. Cache for the process lifetime; plans change rarely.

```go
plans, err := client.Billing.Plans(ctx)
for _, p := range plans {
    fmt.Printf("%v — Rp%v\n", p["name"], p["priceCents"])
}
```

### CurrentPlan

**Signature.** `func (r *BillingResource) CurrentPlan(ctx context.Context) (map[string]any, error)`

The merchant's current plan. Identical shape to one entry in `Plans()`, plus a `currentPeriodEnd` timestamp.

```go
current, err := client.Billing.CurrentPlan(ctx)
```

### Subscription

**Signature.** `func (r *BillingResource) Subscription(ctx context.Context) (map[string]any, error)`

The full subscription object &mdash; status, period, cancel-at-end flag, Plugipay subscription ID, the merchant-side payment method ID.

```go
sub, err := client.Billing.Subscription(ctx)
if status, _ := sub["status"].(string); status == "past_due" {
    notifyMerchant()
}
```

### Usage

**Signature.** `func (r *BillingResource) Usage(ctx context.Context) (map[string]any, error)`

Current period's metered usage &mdash; shipment count, stock movement count, license issuance count &mdash; against the plan's caps.

```go
usage, err := client.Billing.Usage(ctx)
```

### Invoices

**Signature.** `func (r *BillingResource) Invoices(ctx context.Context, p BillingInvoicesParams) (*BillingInvoicesResult, error)`

Cursor-paginated invoice list. `Limit` defaults to 25, max 100.

```go
var cursor string
for {
    result, err := client.Billing.Invoices(ctx, fulkruma.BillingInvoicesParams{
        Limit:  50,
        Cursor: cursor,
    })
    if err != nil {
        return err
    }
    for _, inv := range result.Invoices {
        fmt.Println(inv)
    }
    if result.NextCursor == "" {
        break
    }
    cursor = result.NextCursor
}
```

### Checkout

**Signature.** `func (r *BillingResource) Checkout(ctx context.Context, in BillingCheckoutInput) (*BillingCheckoutResult, error)`

Creates a Plugipay-hosted checkout session for upgrading/changing plans.

```go
result, err := client.Billing.Checkout(ctx, fulkruma.BillingCheckoutInput{
    PlanID:     "plan_growth",
    SuccessURL: "https://your-portal.example.com/billing?ok=1",
    CancelURL:  "https://your-portal.example.com/billing?cancelled=1",
})
if err != nil {
    return err
}
// Redirect the merchant's browser to result.URL
```

The hosted URL handles card capture + 3DS + the partner-billing routing back to Fulkruma. On success, Plugipay calls our internal webhook which updates the subscription; the merchant lands on `SuccessURL`.

### Cancel

**Signature.** `func (r *BillingResource) Cancel(ctx context.Context) (map[string]any, error)`

Cancels the subscription **at period end** &mdash; the merchant keeps access until the current period closes.

```go
_, err := client.Billing.Cancel(ctx)
```

Idempotent &mdash; calling on an already-cancelling subscription is a no-op. To un-cancel, run `Checkout` against the same plan again.

## Types

```go
type BillingInvoicesParams struct {
    Limit  int
    Cursor string
}

type BillingInvoicesResult struct {
    Invoices   []map[string]any `json:"invoices"`
    NextCursor string           `json:"nextCursor,omitempty"`
}

type BillingCheckoutInput struct {
    PlanID     string `json:"planId"`
    SuccessURL string `json:"successUrl,omitempty"`
    CancelURL  string `json:"cancelUrl,omitempty"`
}

type BillingCheckoutResult struct {
    URL       string `json:"url"`
    SessionID string `json:"sessionId"`
}
```

Plan and subscription endpoints return `map[string]any` because the per-plan feature map and per-subscription field shape evolve faster than the SDK release cycle. Stable fields:

- `plans[].id`, `plans[].name`, `plans[].priceCents`
- `subscription.status` &mdash; `"active" | "trialing" | "past_due" | "cancelled" | "incomplete"`
- `subscription.currentPeriodEnd` &mdash; ISO-8601
- `invoices[].id`, `invoices[].amountCents`, `invoices[].paidAt`

See [**API &rarr; Billing**](/docs/api/resources/billing) for the per-version field map.

## Common patterns

### Render a billing dashboard

Three independent reads &mdash; parallelize with `errgroup`:

```go
import "golang.org/x/sync/errgroup"

func billingDashboard(ctx context.Context, c *fulkruma.Client) (map[string]any, error) {
    var sub, usage map[string]any
    var plans []map[string]any
    g, ctx := errgroup.WithContext(ctx)
    g.Go(func() error { var err error; sub, err = c.Billing.Subscription(ctx); return err })
    g.Go(func() error { var err error; usage, err = c.Billing.Usage(ctx); return err })
    g.Go(func() error { var err error; plans, err = c.Billing.Plans(ctx); return err })
    if err := g.Wait(); err != nil {
        return nil, err
    }
    return map[string]any{"subscription": sub, "usage": usage, "plans": plans}, nil
}
```

### Upgrade flow

```go
func upgradeTo(ctx context.Context, c *fulkruma.Client, planID string) (string, error) {
    portalURL := os.Getenv("PORTAL_URL")
    result, err := c.Billing.Checkout(ctx, fulkruma.BillingCheckoutInput{
        PlanID:     planID,
        SuccessURL: portalURL + "/billing?upgrade=success",
        CancelURL:  portalURL + "/billing?upgrade=cancelled",
    })
    if err != nil {
        return "", err
    }
    return result.URL, nil
}
```

### Listen for plan changes

Don't poll `Subscription()`; subscribe to `fulkruma.subscription.updated`:

```go
_, err := client.Webhooks.CreateEndpoint(ctx, fulkruma.WebhookEndpointCreateInput{
    URL:    "https://your-portal.example.com/webhooks/fulkruma",
    Events: []string{"fulkruma.subscription.updated"},
})
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Unknown `PlanID`, bad URL format on checkout. |
| `not_found` | 404 | Plan ID doesn't exist; merchant has no subscription yet. |
| `conflict` | 409 | Checkout on a plan the merchant already has; cancel on an already-cancelled sub. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:billing:read` / `:write`. |
| `plugipay_error` | 502 | Upstream Plugipay returned an error. |

`plugipay_error` is the retry candidate.

## Next

- [**Integrations**](/docs/sdk/go/resources/integrations) &mdash; check the Plugipay link status if billing isn't working.
- [**API &rarr; Billing**](/docs/api/resources/billing) &mdash; HTTP reference.
- [**Webhooks**](/docs/sdk/go/resources/webhooks) &mdash; subscribe to `subscription.updated`.
