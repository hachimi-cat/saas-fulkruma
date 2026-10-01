---
title: Webhooks
---

# Webhooks

Webhooks let Fulkruma push event notifications to your server in real time, so you don't have to poll. Use them to know when a shipment moves through carrier states, when a stock movement was logged, when a license was issued or revoked. The Go SDK exposes seven methods behind `client.Webhooks`. For wire shapes, see [**API &rarr; Webhooks**](/docs/api/resources/webhooks); for the per-event payload schemas, see [**Webhook events**](/docs/api/webhooks/events/fulkruma.product.created).

## Field on the Client

`client.Webhooks` &mdash; type `*fulkruma.WebhooksResource`. Seven methods. Four manage delivery endpoints; three read and act on the delivery log &mdash; what Fulkruma sent, what your server answered, every retry (`ListEvents`, `GetEvent`, `RetryEvent`).

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

`PATCH` semantics. Pass `Active: &false` to pause delivery without deleting the endpoint: deliveries still queued for it become `failed`, and events raised while it is paused are not queued for it. `Active: &true` re-enables it &mdash; also after Fulkruma switched it off for failing &mdash; and clears its failure streak (`consecutiveFailures`, `failingSince`, `disabledAt`, `disabledReason`). A new `URL` is checked like on create (https, no private addresses); the secret stays the same.

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

Hard-deletes the endpoint and its delivery log. A request already in flight may still arrive; nothing new is queued for it.

```go
ok, err := client.Webhooks.DeleteEndpoint(ctx, "whe_01HX...")
```

### ListEvents

**Signature.** `func (r *WebhooksResource) ListEvents(ctx context.Context, p WebhookEventsListParams) (*WebhookEventsListResult, error)`

The delivery log, newest first &mdash; one `WebhookDelivery` per event per endpoint, with its `Status` (`pending`: queued or waiting for a retry at `NextRetryAt`; `sent`: your endpoint answered 2xx; `failed`: given up), `Attempts`, the last `ResponseCode` / `LastError`, and every attempt made (`DeliveryAttempts`). `Limit` is 1&ndash;200 (default 50); pass `NextCursor` back as `Cursor` for the next page (it is nil on the last).

```go
p := fulkruma.WebhookEventsListParams{Status: "failed", Limit: 100}
for {
    page, err := client.Webhooks.ListEvents(ctx, p)
    if err != nil {
        return err
    }
    for _, d := range page.Events {
        log.Println(d.EventID, d.Type, *d.LastError)
    }
    if page.NextCursor == nil {
        break
    }
    p.Cursor = *page.NextCursor
}
```

### GetEvent

**Signature.** `func (r *WebhooksResource) GetEvent(ctx context.Context, id string) (*WebhookDelivery, error)`

One delivery with every attempt made at it.

### RetryEvent

**Signature.** `func (r *WebhooksResource) RetryEvent(ctx context.Context, id string) (*WebhookDelivery, error)`

Queues one more attempt now &mdash; a `failed` delivery once your handler is fixed, or a `sent` one to send again. The server answers `202` with the delivery in `pending`; the attempt goes out within seconds, so read it back with `GetEvent`. A `409` (`ALREADY_QUEUED`, `ENDPOINT_DISABLED`) when the delivery is already queued or its endpoint is off.

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

// Endpoints (ListEndpoints / UpdateEndpoint) also carry their delivery health:
// "consecutiveFailures", "failingSince", "disabledAt", "disabledReason".

type WebhookEventsListParams struct {
    Limit      int    // 1-200, default 50
    Cursor     string // the previous page's NextCursor
    Type       string // e.g. "fulkruma.shipment.created.v1"
    Status     string // "pending" | "sent" | "failed"
    EndpointID string
}

type WebhookEventsListResult struct {
    Events     []WebhookDelivery `json:"events"`
    NextCursor *string           `json:"nextCursor"`
}

type WebhookDelivery struct {
    ID               string                   `json:"id"`
    AccountID        string                   `json:"accountId"`
    EndpointID       string                   `json:"endpointId"`
    EventID          string                   `json:"eventId"` // the envelope's id, the same on every attempt
    Type             string                   `json:"type"`
    Payload          WebhookEventEnvelope     `json:"payload"` // the body sent
    Status           string                   `json:"status"`  // pending | sent | failed
    Attempts         int                      `json:"attempts"`
    LastAttemptAt    *string                  `json:"lastAttemptAt"`
    NextRetryAt      *string                  `json:"nextRetryAt"`
    ResponseCode     *int                     `json:"responseCode"` // nil when no response came back
    ResponseBody     *string                  `json:"responseBody"` // first 2 KiB of the last response
    LastError        *string                  `json:"lastError"`    // "HTTP 503", "timed out after 10000ms", "blocked: …"
    DurationMs       *int                     `json:"durationMs"`
    DeliveredAt      *string                  `json:"deliveredAt"`
    CreatedAt        string                   `json:"createdAt"`
    UpdatedAt        string                   `json:"updatedAt"`
    DeliveryAttempts []WebhookDeliveryAttempt `json:"deliveryAttempts"` // oldest first
}

type WebhookDeliveryAttempt struct {
    ID             string  `json:"id"`
    WebhookEventID string  `json:"webhookEventId"`
    AccountID      string  `json:"accountId"`
    EndpointID     string  `json:"endpointId"`
    AttemptNumber  int     `json:"attemptNumber"`
    Status         string  `json:"status"` // succeeded | failed
    ResponseCode   *int    `json:"responseCode"`
    DurationMs     int     `json:"durationMs"`
    Error          *string `json:"error"`
    NextRetryAt    *string `json:"nextRetryAt"` // the retry this failure scheduled
    AttemptedAt    string  `json:"attemptedAt"`
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

### Riding out a deploy, and catching up afterwards

You don't need to pause an endpoint for a deploy: a failed delivery is retried 1 min, 5 min, 25 min, 2 h and 12 h later, so a receiver that is down for a while still gets everything. Pausing (`Active: &false`) stops deliveries altogether &mdash; events raised while paused are not queued for that endpoint.

If deliveries did give up (or Fulkruma switched the endpoint off after it kept failing), re-enable it and retry what failed:

```go
on := true
if _, err := client.Webhooks.UpdateEndpoint(ctx, "whe_01HX...", fulkruma.WebhookEndpointUpdateInput{Active: &on}); err != nil {
    return err
}
p := fulkruma.WebhookEventsListParams{EndpointID: "whe_01HX...", Status: "failed"}
for {
    page, err := client.Webhooks.ListEvents(ctx, p)
    if err != nil {
        return err
    }
    for _, d := range page.Events {
        if _, err := client.Webhooks.RetryEvent(ctx, d.ID); err != nil {
            return err
        }
    }
    if page.NextCursor == nil {
        break
    }
    p.Cursor = *page.NextCursor
}
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
| `VALIDATION` | 400 | `URL` isn't a URL Fulkruma will call (not https, or a private / loopback / link-local address &mdash; the message says which), or `Events` is empty or holds something other than `"*"`, an event type or a `"fulkruma.….*"` prefix. |
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |
| `NOT_FOUND` | 404 | No endpoint (update / delete) or delivery (GetEvent / RetryEvent) with that ID in this workspace. |
| `ALREADY_QUEUED` | 409 | `RetryEvent` on a delivery that is already `pending`. |
| `ENDPOINT_DISABLED` | 409 | `RetryEvent` while the delivery's endpoint is paused or switched off. |

## Next

- [**Webhook events overview**](/docs/api/webhooks/events/fulkruma.product.created) &mdash; per-event payload schemas.
- [**Audit log**](/docs/sdk/go/resources/audit-log) &mdash; complementary on-side ledger of actions.
- [**API &rarr; Webhooks**](/docs/api/resources/webhooks) &mdash; HTTP reference.
