---
title: Audit log
---

# Audit log

The audit log is the append-only ledger of every meaningful action taken in a workspace &mdash; key mints, key revocations, stock adjustments, shipment bookings, integration toggles, plan changes. It's the same data the portal's "Activity" page renders. The Python SDK wraps one endpoint behind `fulkruma.audit_log`. For HTTP shapes, see [**API &rarr; Audit log**](/docs/api/resources/audit-log).

## Namespace

```python
fulkruma.audit_log     # AuditLogResources
```

One method. Audit entries are write-only from the system's side &mdash; you can't `create` or `delete` them via the SDK by design.

## Methods

### `list`

```python
fulkruma.audit_log.list(
    *,
    limit: int | None = None,
    cursor: str | None = None,
    since: str | None = None,
    event_type: str | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Returns audit entries newest-first, cursor-paginated. Filters: `limit` (default 25, max 100), `cursor`, `since` (ISO-8601, exclusive), `event_type` (exact-match on the audit event type).

```python
result = fulkruma.audit_log.list(
    limit=50,
    since="2026-05-01T00:00:00Z",
    event_type="apikey.created",
)

for e in result["entries"]:
    print(e["createdAt"], e["actorId"], e["eventType"])

if result.get("nextCursor"):
    more = fulkruma.audit_log.list(cursor=result["nextCursor"], limit=50)
```

Common `event_type` values:

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

```python
{
    "entries": [
        {
            "id": "...",
            "accountId": "acc_...",
            "actorId": "user_..." | "system",
            "actorType": "user" | "apikey" | "system",
            "eventType": "apikey.created",
            "payload": {...},        # event-type-specific
            "requestId": "..." | None,
            "createdAt": "..."
        },
        ...
    ],
    "nextCursor": "..." | None
}
```

`payload` shapes vary by `eventType` &mdash; treat as unknown-typed and pick fields out at the per-type call site. See [**API &rarr; Audit log**](/docs/api/resources/audit-log) for the per-event schema.

## Common patterns

**Tail the most recent activity.** For a "what just happened?" pane:

```python
def recent(fulkruma):
    return fulkruma.audit_log.list(limit=25)["entries"]
```

**Walk the full ledger.** For an export-to-CSV job:

```python
def walk_all(fulkruma, since: str | None = None):
    cursor = None
    while True:
        result = fulkruma.audit_log.list(limit=100, cursor=cursor, since=since)
        yield from result["entries"]
        cursor = result.get("nextCursor")
        if not cursor:
            return

# Usage:
import csv
with open("audit.csv", "w") as f:
    w = csv.writer(f)
    w.writerow(["createdAt", "actor", "type"])
    for e in walk_all(fulkruma, since="2026-01-01T00:00:00Z"):
        w.writerow([e["createdAt"], e["actorId"], e["eventType"]])
```

**Filter on event type.** For a security review focused on key management:

```python
sensitive = ["apikey.created", "apikey.revoked", "integration.connected"]
for type_ in sensitive:
    result = fulkruma.audit_log.list(limit=100, event_type=type_)
    print(type_, len(result["entries"]))
```

You can only pass one `event_type` per call &mdash; loop client-side if you need multiple.

**Tie to a request ID.** When investigating a customer issue, find every audit entry from a specific request:

```python
def entries_for_request(fulkruma, request_id: str):
    result = fulkruma.audit_log.list(limit=100)
    return [e for e in result["entries"] if e.get("requestId") == request_id]
```

Every Fulkruma response carries `meta.requestId`; the audit log copies it onto every entry that request generated.

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Bad `since` format, `limit` out of range. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:auditlog:read`. |

The audit log can't 404 individual entries &mdash; the SDK only exposes list. Use the filters to narrow down.

## Next

- [**API keys**](/docs/sdk/python/resources/api-keys) &mdash; the most-audited resource.
- [**Webhooks**](/docs/sdk/python/resources/webhooks) &mdash; subscribe to `fulkruma.audit.created` for real-time monitoring.
- [**API &rarr; Audit log**](/docs/api/resources/audit-log) &mdash; HTTP reference, including the full `eventType` and `payload` catalog.
