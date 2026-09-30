---
title: Audit log
---

# Audit log

The **audit log** is the ledger of workspace-changing actions &mdash; key mints and revocations, product and variant changes, deliveries, webhook endpoints, shipping settings, partner provisioning. It's the same data the portal's activity view renders. The Go SDK exposes one method behind `client.AuditLog`. For wire shapes, see [**API &rarr; Audit log**](/docs/api/resources/audit-log).

## Field on the Client

`client.AuditLog` &mdash; type `*fulkruma.AuditLogResource`. One method. Audit entries are written by the system only &mdash; you can't `Create` or `Delete` them via the SDK by design.

## Methods

### List

**Signature.** `func (r *AuditLogResource) List(ctx context.Context, p AuditLogListParams) (*AuditLogListResult, error)`

Returns audit entries newest first. Filters:

- `Action` &mdash; a **prefix** of the action name: `"api_key."` matches `api_key.created` and `api_key.revoked`; `"product"` matches every `product.*` action.
- `TargetType` &mdash; the exact resource type, e.g. `"Product"`, `"ApiKey"`.
- `Limit` &mdash; default 100, max 500.

There is no cursor and no date filter: a call returns the newest `Limit` entries that match. To reach further back, narrow `Action` / `TargetType`.

```go
result, err := client.AuditLog.List(ctx, fulkruma.AuditLogListParams{
    Action: "api_key.",
    Limit:  50,
})
if err != nil {
    return err
}
for _, e := range result.Entries {
    fmt.Println(e["createdAt"], e["actorType"], e["actorId"], e["action"], e["targetId"])
}
```

Action names in use:

- `api_key.created` / `api_key.revoked`
- `product.created` / `product.updated` / `product.archived`
- `variant.created` / `variant.updated` / `variant.archived`
- `delivery.created` / `delivery.extend` / `delivery.reset-downloads` / `delivery.revoke`
- `webhook.created` / `webhook.updated` / `webhook.deleted`
- `shipping.origin_updated` / `shipping.config_updated`
- `partner.workspace_provisioned`
- `storlaunch.product.synced`

What triggers each is in [**API &rarr; Audit log**](/docs/api/resources/audit-log#actions).

## Types

```go
type AuditLogListParams struct {
    Action     string // prefix match
    TargetType string
    Limit      int    // default 100, max 500
}

type AuditLogListResult struct {
    Entries []map[string]any `json:"entries"`
}
```

Each entry map has these keys:

- `id`, `accountId` (string)
- `actorType` (`"user"`, `"api_key"` or `"system"`)
- `actorId` (string or null) &mdash; Huudis user ID, or the workspace ID for an API-key call
- `actorEmail` (string or null)
- `action` (string)
- `targetType`, `targetId` (string or null)
- `ip`, `userAgent` (string or null)
- `before`, `after` (map or null) &mdash; the fields the action changed; shape varies by action
- `metadata` (map)
- `createdAt` (RFC 3339 string)

See [**API &rarr; Audit log**](/docs/api/resources/audit-log#the-audit-entry-object).

## Common patterns

### Tail the most recent activity

```go
result, err := client.AuditLog.List(ctx, fulkruma.AuditLogListParams{Limit: 25})
// result.Entries is already newest-first
```

### Export what the log holds for one resource type

Take the most the endpoint returns in one call:

```go
func exportProducts(ctx context.Context, c *fulkruma.Client, w *csv.Writer) error {
    result, err := c.AuditLog.List(ctx, fulkruma.AuditLogListParams{TargetType: "Product", Limit: 500})
    if err != nil {
        return err
    }
    for _, e := range result.Entries {
        _ = w.Write([]string{fmt.Sprint(e["createdAt"]), fmt.Sprint(e["actorId"]), fmt.Sprint(e["action"]), fmt.Sprint(e["targetId"])})
    }
    w.Flush()
    return w.Error()
}
```

If a resource type has more than 500 entries, only the newest 500 come back; split the export by `Action` prefix to reach more.

### Several actions

`Action` is a single prefix per call &mdash; loop client-side if you need several:

```go
func entriesForActions(ctx context.Context, c *fulkruma.Client, prefixes []string) ([]map[string]any, error) {
    var out []map[string]any
    for _, p := range prefixes {
        result, err := c.AuditLog.List(ctx, fulkruma.AuditLogListParams{Action: p, Limit: 500})
        if err != nil {
            return nil, err
        }
        out = append(out, result.Entries...)
    }
    return out, nil
}
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |

Unknown `Action` / `TargetType` values aren't errors &mdash; they match nothing and return an empty list.

## Next

- [**API keys**](/docs/sdk/go/resources/api-keys) &mdash; the most-audited resource.
- [**Webhooks**](/docs/sdk/go/resources/webhooks) &mdash; real-time events for shipments, stock and licenses (the audit log itself emits none).
- [**API &rarr; Audit log**](/docs/api/resources/audit-log) &mdash; HTTP reference, including the full action table.
