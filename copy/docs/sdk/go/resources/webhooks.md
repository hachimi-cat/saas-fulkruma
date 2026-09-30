---
title: Webhooks
---

# Webhooks

Webhooks let Fulkruma push event notifications to your server in real time, so you don't have to poll. Use them to know when a shipment moves through carrier states, when a stock movement was logged, when a license was issued or revoked. The Go SDK exposes five methods behind `client.Webhooks`. For wire shapes, see [**API &rarr; Webhooks**](/docs/api/resources/webhooks); for the per-event payload schemas, see [**Webhook events**](/docs/api/webhooks/events/fulkruma.product.created).

## Field on the Client

`client.Webhooks` &mdash; type `*fulkruma.WebhooksResource`. Five methods. Four manage delivery endpoints; one (`ListEvents`) reads the most recent delivery records.

## Methods

### CreateEndpoint

**Signature.** `func (r *WebhooksResource) CreateEndpoint(ctx context.Context, in WebhookEndpointCreateInput) (*WebhookEndpointCreated, error)`

Registers a URL to receive event deliveries. `Events` narrows the types (`["*"]`, every event, when empty); patterns like `"fulkruma.shipment.*"` are allowed. The result carries the endpoint and its signing `Secret` &mdash; **this is the only call that returns the secret**. The SDK auto-mints an `Idempotency-Key`.

```go
created, err := client.Webhooks.CreateEndpoint(ctx, fulkruma.WebhookEndpointCreateInput{
    URL:         "https://your-app.example.com/webhooks/fulkruma",
    Events:      []string{"fulkruma.shipment.*", "fulkruma.license.issued.v1"},
    Description: "Production receiver",
})
if err != nil {
    return err
}
log.Println(created.Endpoint["id"])  // STASH created.Secret NOW (whsec_...)
```

<blockquote class="callout-warn">

**The signing secret appears once.** Just like API keys, the webhook signing secret is only returned on create. You'll use it to verify the `Fulkruma-Signature` header on every inbound delivery (see [Verify inbound deliveries](#verify-inbound-deliveries)). Store it before the function returns.

</blockquote>

### ListEndpoints

**Signature.** `func (r *WebhooksResource) ListEndpoints(ctx context.Context) ([]map[string]any, error)`

Returns every endpoint in the workspace, newest first. The secret is **not** included &mdash; only a `secretPreview` (`whsec_…` plus its last 4 characters); `CreateEndpoint` alone returns the secret.

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
newEvents := []string{"fulkruma.shipment.status_updated.v1", "fulkruma.shipment.cancelled.v1"}
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

**Signature.** `func (r *WebhooksResource) ListEvents(ctx context.Context) (*WebhookEventsListResult, error)`

The workspace's 50 most recent delivery records, newest first &mdash; one per event per endpoint, with its delivery `status` (`pending`, `sent`, `failed`), `attempts` and the receiver's `responseCode`. It takes no filters and has no pagination; filter the rows yourself.

```go
result, err := client.Webhooks.ListEvents(ctx)
if err != nil {
    return err
}
for _, e := range result.Events {
    if e["status"] == "failed" {
        log.Println(e["type"], e["responseCode"])
    }
}
```

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

type WebhookEndpointCreated struct {
    Endpoint map[string]any `json:"endpoint"`
    Secret   string         `json:"secret"`
}

// Delivery records: id, accountId, endpointId, type, payload (the event
// envelope sent), status (pending | sent | failed), attempts, lastAttemptAt,
// nextRetryAt, responseCode, responseBody, createdAt, updatedAt.
type WebhookEventsListResult struct {
    Events []map[string]any `json:"events"`
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
    id, _ := created.Endpoint["id"].(string)
    if err := secretManager.Put("FULKRUMA_WEBHOOK_SECRET/"+id, created.Secret); err != nil {
        return nil, err
    }
    return created.Endpoint, nil
}
```

### Verify inbound deliveries

The SDK ships a `VerifyWebhook` helper. It checks the `Fulkruma-Signature: t=<unix>,v1=<hex>` header &mdash; an HMAC-SHA256 of `<t>.<raw body>` with the endpoint's secret &mdash; and rejects a timestamp more than 5 minutes off (`VerifyWebhookOptions.ToleranceSec` changes that):

```go
import (
    "net/http"
    "os"
    "io"

    "github.com/hachimi-cat/fulkruma-go"
)

func handleWebhook(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    event, err := fulkruma.VerifyWebhook(body, r.Header.Get("Fulkruma-Signature"),
        os.Getenv("FULKRUMA_WEBHOOK_SECRET"), nil)
    if err != nil {
        http.Error(w, "invalid signature", http.StatusBadRequest)
        return
    }
    // event is the typed delivery; handle by Type
    _ = event
    w.WriteHeader(http.StatusOK)
}
```

### Pause-replay-resume during a release

For a risky deploy you want to ingest events synchronously:

```go
// 1. Pause
paused := false
client.Webhooks.UpdateEndpoint(ctx, "whe_01HX...",
    fulkruma.WebhookEndpointUpdateInput{Active: &paused})

// 2. Deploy your new handler.

// 3. Catch up on what was queued meanwhile (the 50 most recent deliveries)
cutoff := "2026-05-13T10:00:00Z"
result, _ := client.Webhooks.ListEvents(ctx)
for _, e := range result.Events {
    if t, _ := e["createdAt"].(string); t >= cutoff {
        handleManually(e["payload"])
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
| `VALIDATION` | 400 | `URL` isn't a URL, or `Events` is an empty list. |
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |
| `NOT_FOUND` | 404 | No endpoint with that ID in this workspace (update / delete). |

## Next

- [**Webhook events overview**](/docs/api/webhooks/events/fulkruma.product.created) &mdash; per-event payload schemas.
- [**Audit log**](/docs/sdk/go/resources/audit-log) &mdash; complementary on-side ledger of actions.
- [**API &rarr; Webhooks**](/docs/api/resources/webhooks) &mdash; HTTP reference.
