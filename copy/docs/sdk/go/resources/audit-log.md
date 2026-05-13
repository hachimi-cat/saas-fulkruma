---
title: Audit log
---

# Audit log

The **audit log** is the append-only ledger of every meaningful action taken in a workspace &mdash; key mints, key revocations, stock adjustments, shipment bookings, integration toggles, plan changes. It's the same data the portal's "Activity" page renders. The Go SDK exposes one method behind `client.AuditLog`. For wire shapes, see [**API &rarr; Audit log**](/docs/api/resources/audit-log).

## Field on the Client

`client.AuditLog` &mdash; type `*fulkruma.AuditLogResource`. One method. Audit entries are write-only from the system's side &mdash; you can't `Create` or `Delete` them via the SDK by design.

## Methods

### List

**Signature.** `func (r *AuditLogResource) List(ctx context.Context, p AuditLogListParams) (*AuditLogListResult, error)`

Returns audit entries newest-first, cursor-paginated. Filters: `Limit` (default 25, max 100), `Cursor`, `Since` (ISO-8601, exclusive), `EventType` (exact-match).

```go
result, err := client.AuditLog.List(ctx, fulkruma.AuditLogListParams{
    Limit:     50,
    Since:     "2026-05-01T00:00:00Z",
    EventType: "apikey.created",
})
if err != nil {
    return err
}
for _, e := range result.Entries {
    fmt.Println(e["createdAt"], e["actorId"], e["eventType"])
}
if result.NextCursor != "" {
    more, err := client.AuditLog.List(ctx, fulkruma.AuditLogListParams{
        Cursor: result.NextCursor, Limit: 50,
    })
    _ = more
    _ = err
}
```

Common `EventType` values:

- `apikey.created` / `apikey.revoked`
- `warehouse.created` / `warehouse.updated` / `warehouse.archived`
- `product.created` / `product.updated` / `product.archived`
- `stock.adjusted`
- `shipment.created`
- `license.issued` / `license.revoked`
- `delivery.created`
- `integration.connected` / `integration.disconnected`
- `subscription.changed`

The full vocabulary lives in [**API &rarr; Audit log**](/docs/api/resources/audit-log).

## Types

```go
type AuditLogListParams struct {
    Limit     int
    Cursor    string
    Since     string
    EventType string
}

type AuditLogListResult struct {
    Entries    []map[string]any `json:"entries"`
    NextCursor string           `json:"nextCursor,omitempty"`
}
```

Entries are `map[string]any` because the `payload` field shape is event-type-specific. Per-entry keys:

- `id` (string)
- `accountId` (string, `"acc_..."`)
- `actorId` (string, `"user_..."` or `"system"`)
- `actorType` (string, `"user" | "apikey" | "system"`)
- `eventType` (string)
- `payload` (map &mdash; shape depends on `eventType`)
- `requestId` (string or null)
- `createdAt` (string, ISO-8601)

See [**API &rarr; Audit log**](/docs/api/resources/audit-log) for the per-event payload schemas.

## Common patterns

### Tail the most recent activity

```go
func recent(ctx context.Context, c *fulkruma.Client) ([]map[string]any, error) {
    result, err := c.AuditLog.List(ctx, fulkruma.AuditLogListParams{Limit: 25})
    if err != nil {
        return nil, err
    }
    return result.Entries, nil
}
```

### Walk the full ledger

For an export-to-CSV job:

```go
func walkAll(ctx context.Context, c *fulkruma.Client, since string, fn func(map[string]any)) error {
    var cursor string
    for {
        result, err := c.AuditLog.List(ctx, fulkruma.AuditLogListParams{
            Limit: 100, Cursor: cursor, Since: since,
        })
        if err != nil {
            return err
        }
        for _, e := range result.Entries {
            fn(e)
        }
        if result.NextCursor == "" {
            return nil
        }
        cursor = result.NextCursor
    }
}

// Usage:
walkAll(ctx, client, "2026-01-01T00:00:00Z", func(e map[string]any) {
    writeRow(e)
})
```

### Filter on event type

For a security review focused on key management:

```go
sensitive := []string{"apikey.created", "apikey.revoked", "integration.connected"}
for _, typ := range sensitive {
    result, err := client.AuditLog.List(ctx, fulkruma.AuditLogListParams{
        Limit: 100, EventType: typ,
    })
    if err != nil {
        return err
    }
    fmt.Println(typ, len(result.Entries))
}
```

You can only pass one `EventType` per call &mdash; loop client-side if you need multiple.

### Tie to a request ID

When investigating a customer issue, find every audit entry from a specific request:

```go
func entriesForRequest(ctx context.Context, c *fulkruma.Client, requestID string) ([]map[string]any, error) {
    result, err := c.AuditLog.List(ctx, fulkruma.AuditLogListParams{Limit: 100})
    if err != nil {
        return nil, err
    }
    var out []map[string]any
    for _, e := range result.Entries {
        if rid, _ := e["requestId"].(string); rid == requestID {
            out = append(out, e)
        }
    }
    return out, nil
}
```

Every Fulkruma response carries `meta.requestId`; the audit log copies it onto every entry that request generated.

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Bad `Since` format, `Limit` out of range. |
| `insufficient_scope` | 403 | Key lacks `fulkruma:auditlog:read`. |

The audit log can't 404 individual entries &mdash; the SDK only exposes list. Use the filters to narrow down.

## Next

- [**API keys**](/docs/sdk/go/resources/api-keys) &mdash; the most-audited resource.
- [**Webhooks**](/docs/sdk/go/resources/webhooks) &mdash; subscribe to `fulkruma.audit.created` for real-time monitoring.
- [**API &rarr; Audit log**](/docs/api/resources/audit-log) &mdash; HTTP reference, including the full `eventType` and `payload` catalog.
