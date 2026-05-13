---
title: Integrations
---

# Integrations

The `integrations` namespace is the **status read** for every external system Fulkruma talks to &mdash; Huudis (auth), Biteship (couriers), Plugipay (billing), Storlaunch (storefront sync). Useful for portal "connection health" pages, support diagnostics, and pre-flight checks before a big sync job. For wire shapes, see [**API &rarr; Integrations**](/docs/api/resources/integrations).

## Field on the Client

`client.Integrations` &mdash; type `*fulkruma.IntegrationsResource`. One method. There's no `Connect` or `Disconnect` here &mdash; those flows live in the portal UI and OAuth callback routes, not the public API. This namespace is read-only.

## Methods

### Status

**Signature.** `func (r *IntegrationsResource) Status(ctx context.Context) (*IntegrationsStatus, error)`

Returns the current state of each integration. Every provider field is a nullable map &mdash; an absent map means "never connected"; a present map with `status: "disconnected"` means "was connected, currently broken". The shape per provider is provider-specific but always includes a `status` field.

```go
status, err := client.Integrations.Status(ctx)
if err != nil {
    return err
}
if v, ok := status.Biteship["status"].(string); !ok || v != "connected" {
    log.Println("Shipping is degraded — Biteship not connected")
}
```

The merchant-side connection details (OAuth scopes for Huudis, API key fingerprints for Biteship, partner billing routing for Plugipay) are summarized here, **never** the raw secrets.

## Types

```go
type IntegrationsStatus struct {
    Huudis     map[string]any `json:"huudis,omitempty"`
    Biteship   map[string]any `json:"biteship,omitempty"`
    Plugipay   map[string]any `json:"plugipay,omitempty"`
    Storlaunch map[string]any `json:"storlaunch,omitempty"`
}
```

Per-provider field shape (informally):

```go
// status.Biteship
map[string]any{
    "status":         "connected",
    "keyFingerprint": "abc123…",
    "couriers":       []any{"jne", "jnt"},
    "connectedAt":    "...",
}

// status.Plugipay
map[string]any{
    "status":      "connected",
    "accountId":   "acc_…",
    "partnerMode": true,
    "connectedAt": "...",
}
```

The exact field shape per provider is documented at [**API &rarr; Integrations**](/docs/api/resources/integrations). New providers may appear over time; old providers may drop fields. Always read defensively (`status.Biteship["status"]` rather than assuming non-nil).

## Common patterns

### Pre-flight check before a big import

```go
func preflight(ctx context.Context, c *fulkruma.Client) error {
    status, err := c.Integrations.Status(ctx)
    if err != nil {
        return err
    }
    var problems []string
    if v, _ := status.Huudis["status"].(string); v != "connected" {
        problems = append(problems, "huudis")
    }
    if v, _ := status.Biteship["status"].(string); v != "connected" {
        problems = append(problems, "biteship")
    }
    if v, _ := status.Plugipay["status"].(string); v != "connected" {
        problems = append(problems, "plugipay")
    }
    if len(problems) > 0 {
        return fmt.Errorf("broken integrations: %s", strings.Join(problems, ", "))
    }
    return nil
}
```

Run this before kicking off a bulk product sync from Storlaunch or a big shipment batch &mdash; cheaper to fail fast.

### Portal health badge

```go
func integrationHealth(ctx context.Context, c *fulkruma.Client) (string, error) {
    status, err := c.Integrations.Status(ctx)
    if err != nil {
        return "", err
    }
    allOK := true
    for _, m := range []map[string]any{status.Huudis, status.Biteship, status.Plugipay} {
        if v, _ := m["status"].(string); v != "connected" {
            allOK = false
            break
        }
    }
    if allOK {
        return "green", nil
    }
    return "amber", nil
}
```

Storlaunch is excluded from the "all OK" check because not every merchant connects a storefront &mdash; treat it as opt-in.

### Detect a regression

Compare against a previous snapshot:

```go
var lastSnapshot *fulkruma.IntegrationsStatus

func check(ctx context.Context, c *fulkruma.Client) error {
    snap, err := c.Integrations.Status(ctx)
    if err != nil {
        return err
    }
    if lastSnapshot != nil {
        prev, _ := lastSnapshot.Biteship["status"].(string)
        cur, _ := snap.Biteship["status"].(string)
        if prev == "connected" && cur != "connected" {
            alertSlack("Biteship disconnected!")
        }
    }
    lastSnapshot = snap
    return nil
}
```

In practice, prefer subscribing to the `fulkruma.integration.*` webhook events instead &mdash; same signal, no polling.

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `insufficient_scope` | 403 | Key lacks `fulkruma:integration:read`. |

This namespace doesn't validate input (no input!) and doesn't 404 (it always returns *something*, even if every provider field is nil). The only realistic failure path is auth.

## Next

- [**Billing**](/docs/sdk/go/resources/billing) &mdash; the Plugipay link health matters for billing.
- [**Shipping**](/docs/sdk/go/resources/shipping) &mdash; the Biteship link health matters for rate quotes.
- [**API &rarr; Integrations**](/docs/api/resources/integrations) &mdash; HTTP-level reference.
