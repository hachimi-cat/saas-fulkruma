---
title: Webhooks
---

# Webhooks

Webhooks let Fulkruma push event notifications to your server in real time, so you don't have to poll. Use them to know when a shipment moves through carrier states, when a stock movement was logged, when a license was revoked, when a subscription changed. The Go SDK exposes five methods behind `client.Webhooks`. For wire shapes, see [**API &rarr; Webhooks**](/docs/api/resources/webhooks); for the per-event payload schemas, see [**Webhook events**](/docs/api/webhooks/events/fulkruma.product.created).

## Field on the Client

`client.Webhooks` &mdash; type `*fulkruma.WebhooksResource`. Five methods. Four manage delivery endpoints; one (`ListEvents`) reads the cursor-paginated event ledger &mdash; useful for catching up after a downtime or backfilling state.

## Methods

### CreateEndpoint

**Signature.** `func (r *WebhooksResource) CreateEndpoint(ctx context.Context, in WebhookEndpointCreateInput) (map[string]any, error)`

Registers a URL to receive event deliveries. Optionally narrow the event types (default: all). The returned map includes the `signingSecret` &mdash; **this is the only call that returns it**. The SDK auto-mints an `Idempotency-Key`.

```go
endpoint, err := client.Webhooks.CreateEndpoint(ctx, fulkruma.WebhookEndpointCreateInput{
    URL: "https://your-app.example.com/webhooks/fulkruma",
    Events: []string{
        "fulkruma.shipment.updated",
        "fulkruma.shipment.delivered",
        "fulkruma.license.issued",
    },
    Description: "Production receiver",
})
if err != nil {
    return err
}
log.Println(endpoint["id"], endpoint["signingSecret"])  // STASH signingSecret NOW
```

<blockquote class="callout-warn">

**The signing secret appears once.** Just like API keys, the webhook signing secret is only returned on create. You'll use it to verify the `X-Fulkruma-Signature` header on every inbound delivery (see [**Verifying webhooks**](/docs/sdk/go/verifying-webhooks)). Store it before the function returns.

</blockquote>

### ListEndpoints

**Signature.** `func (r *WebhooksResource) ListEndpoints(ctx context.Context) ([]map[string]any, error)`

Returns every endpoint in the workspace. `signingSecret` is **not** included; only `CreateEndpoint` returns it.

```go
endpoints, err := client.Webhooks.ListEndpoints(ctx)
for _, e := range endpoints {
    state := "active"
    if v, _ := e["active"].(bool); !v {
        state = "paused"
    }
    fmt.Println(e["id"], e["url"], state)
}
```

### UpdateEndpoint

**Signature.** `func (r *WebhooksResource) UpdateEndpoint(ctx context.Context, id string, patch WebhookEndpointUpdateInput) (map[string]any, error)`

`PATCH` semantics. Pass `Active: &false` to pause delivery without deleting the endpoint &mdash; useful during maintenance windows.

```go
active := false
_, err := client.Webhooks.UpdateEndpoint(ctx, "whe_01HX...", fulkruma.WebhookEndpointUpdateInput{
    Active: &active,
})
// ... maintenance ...
active = true
_, err = client.Webhooks.UpdateEndpoint(ctx, "whe_01HX...", fulkruma.WebhookEndpointUpdateInput{
    Active: &active,
})
```

You can also rewrite the URL or the events list:

```go
newURL := "https://new-app.example.com/webhooks/fulkruma"
newEvents := []string{"fulkruma.shipment.updated", "fulkruma.shipment.delivered"}
_, err := client.Webhooks.UpdateEndpoint(ctx, "whe_01HX...", fulkruma.WebhookEndpointUpdateInput{
    URL:    &newURL,
    Events: &newEvents,
})
```

### DeleteEndpoint

**Signature.** `func (r *WebhooksResource) DeleteEndpoint(ctx context.Context, id string) (bool, error)`

Hard-deletes the endpoint. In-flight deliveries (already accepted by our delivery worker) may still arrive briefly after; new events stop being queued immediately.

```go
ok, err := client.Webhooks.DeleteEndpoint(ctx, "whe_01HX...")
```

### ListEvents

**Signature.** `func (r *WebhooksResource) ListEvents(ctx context.Context, p WebhookEventsListParams) (*WebhookEventsListResult, error)`

Cursor-paginated read of every event emitted in the workspace, regardless of whether any endpoint successfully received it. Filters: `Limit` (default 25, max 100), `Cursor`, `Type` (event type).

```go
result, err := client.Webhooks.ListEvents(ctx, fulkruma.WebhookEventsListParams{
    Limit: 100, Type: "fulkruma.shipment.delivered",
})
```

Use this to:
- backfill after your receiver was down,
- replay an event for debugging,
- audit "did we actually emit X?".

## Types

```go
type WebhookEndpointCreateInput struct {
    URL         string   `json:"url"`
    Events      []string `json:"events,omitempty"`
    Description string   `json:"description,omitempty"`
}

type WebhookEndpointUpdateInput struct {
    URL         *string   `json:"url,omitempty"`
    Events      *[]string `json:"events,omitempty"`
    Description *string   `json:"description,omitempty"`
    Active      *bool     `json:"active,omitempty"`
}

type WebhookEventsListParams struct {
    Limit  int
    Cursor string
    Type   string
}

type WebhookEventsListResult struct {
    Events     []map[string]any `json:"events"`
    NextCursor string           `json:"nextCursor,omitempty"`
}
```

For the full event-type catalog and per-type payload schemas, see [**Webhook events**](/docs/api/webhooks/events/fulkruma.product.created).

## Common patterns

### Register at deploy time

```go
func ensureEndpoint(ctx context.Context, c *fulkruma.Client, url string, events []string, secretManager Secrets) (map[string]any, error) {
    endpoints, err := c.Webhooks.ListEndpoints(ctx)
    if err != nil {
        return nil, err
    }
    for _, e := range endpoints {
        if u, _ := e["url"].(string); u == url {
            return e, nil
        }
    }
    created, err := c.Webhooks.CreateEndpoint(ctx, fulkruma.WebhookEndpointCreateInput{
        URL: url, Events: events,
    })
    if err != nil {
        return nil, err
    }
    id, _ := created["id"].(string)
    secret, _ := created["signingSecret"].(string)
    if err := secretManager.Put("FULKRUMA_WEBHOOK_SECRET/"+id, secret); err != nil {
        return nil, err
    }
    return created, nil
}
```

### Verify inbound deliveries

The SDK ships a `VerifyWebhook` helper:

```go
import (
    "net/http"
    "os"
    "io"

    "github.com/hachimi-cat/fulkruma-go"
)

func handleWebhook(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    event, err := fulkruma.VerifyWebhook(fulkruma.WebhookVerifyInput{
        Payload:   body,
        Signature: r.Header.Get("X-Fulkruma-Signature"),
        Timestamp: r.Header.Get("X-Fulkruma-Timestamp"),
        Secret:    os.Getenv("FULKRUMA_WEBHOOK_SECRET"),
    })
    if err != nil {
        http.Error(w, "invalid signature", http.StatusBadRequest)
        return
    }
    // event is the typed delivery; handle by Type
    _ = event
    w.WriteHeader(http.StatusOK)
}
```

See [**Verifying webhooks**](/docs/sdk/go/verifying-webhooks) for the full helper signature.

### Pause-replay-resume during a release

For a risky deploy you want to ingest events synchronously:

```go
// 1. Pause
paused := false
client.Webhooks.UpdateEndpoint(ctx, "whe_01HX...",
    fulkruma.WebhookEndpointUpdateInput{Active: &paused})

// 2. Deploy your new handler.

// 3. Catch up on missed events from the ledger
cutoff := "2026-05-13T10:00:00Z"
result, _ := client.Webhooks.ListEvents(ctx, fulkruma.WebhookEventsListParams{Limit: 100})
for _, e := range result.Events {
    if t, _ := e["createdAt"].(string); t >= cutoff {
        handleManually(e)
    }
}

// 4. Resume
resumed := true
client.Webhooks.UpdateEndpoint(ctx, "whe_01HX...",
    fulkruma.WebhookEndpointUpdateInput{Active: &resumed})
```

### Per-environment endpoints

Provision separate endpoints per environment so prod events never hit staging:

```go
client.Webhooks.CreateEndpoint(ctx, fulkruma.WebhookEndpointCreateInput{
    URL: "https://staging.your-app.example.com/webhooks/fulkruma",
    Description: "staging",
})
client.Webhooks.CreateEndpoint(ctx, fulkruma.WebhookEndpointCreateInput{
    URL: "https://prod.your-app.example.com/webhooks/fulkruma",
    Description: "prod",
})
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Bad URL (must be HTTPS), unknown event type, too many events. |
| `not_found` | 404 | Endpoint or event ID missing. |
| `conflict` | 409 | Same URL already registered. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:webhook:write`. |

## Next

- [**Verifying webhooks**](/docs/sdk/go/verifying-webhooks) &mdash; how to use the `VerifyWebhook` helper.
- [**Webhook events overview**](/docs/api/webhooks/events/fulkruma.product.created) &mdash; per-event payload schemas.
- [**Audit log**](/docs/sdk/go/resources/audit-log) &mdash; complementary on-side ledger of actions.
- [**API &rarr; Webhooks**](/docs/api/resources/webhooks) &mdash; HTTP reference.
