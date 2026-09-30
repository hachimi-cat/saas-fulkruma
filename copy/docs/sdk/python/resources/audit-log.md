---
title: Audit log
---

# Audit log

The audit log is the ledger of workspace-changing actions &mdash; key mints and revocations, product and variant changes, deliveries, webhook endpoints, shipping settings, partner provisioning. It's the same data the portal's activity view renders. The Python SDK wraps one endpoint behind `fulkruma.audit_log`. For HTTP shapes, see [**API &rarr; Audit log**](/docs/api/resources/audit-log).

## Namespace

```python
fulkruma.audit_log     # AuditLogResources
```

One method. Audit entries are written by the system only &mdash; you can't `create` or `delete` them via the SDK by design.

## Methods

### `list`

```python
fulkruma.audit_log.list(
    *,
    action: str | None = None,
    target_type: str | None = None,
    limit: int | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Returns `{"entries": [...]}`, newest first. Filters:

- `action` &mdash; a **prefix** of the action name: `"api_key."` matches `api_key.created` and `api_key.revoked`; `"product"` matches every `product.*` action.
- `target_type` &mdash; the exact resource type, e.g. `"Product"`, `"ApiKey"`.
- `limit` &mdash; default 100, max 500.

There is no cursor and no date filter: a call returns the newest `limit` entries that match. To reach further back, narrow `action` / `target_type`.

```python
result = fulkruma.audit_log.list(action="api_key.", limit=50)
for e in result["entries"]:
    print(e["createdAt"], e["actorType"], e["actorId"], e["action"], e["targetId"])
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

Each entry is a plain dict:

```python
{
    "id": "clx...",
    "accountId": "acc_...",
    "actorType": "user" | "api_key" | "system",
    "actorId": "..." | None,       # Huudis user ID, or the workspace ID for an API-key call
    "actorEmail": "..." | None,
    "action": "api_key.created",
    "targetType": "ApiKey" | None,
    "targetId": "..." | None,
    "ip": "..." | None,
    "userAgent": "..." | None,
    "before": {...} | None,
    "after": {...} | None,
    "metadata": {...},
    "createdAt": "2026-05-12T10:00:00.000Z",
}
```

`before` / `after` carry the fields the action changed and vary by action &mdash; treat them as unknown-typed and pick fields out at the per-action call site. See [**API &rarr; Audit log**](/docs/api/resources/audit-log#the-audit-entry-object).

## Common patterns

**Tail the most recent activity.** For a "what just happened?" pane:

```python
recent = fulkruma.audit_log.list(limit=25)["entries"]   # already newest-first
```

**Export what the log holds for one resource type.** Take the most the endpoint returns in one call:

```python
import csv

entries = fulkruma.audit_log.list(target_type="Product", limit=500)["entries"]
with open("product-audit.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["createdAt", "actorId", "action", "targetId"])
    for e in entries:
        w.writerow([e["createdAt"], e["actorId"], e["action"], e["targetId"]])
```

If a resource type has more than 500 entries, only the newest 500 come back; split the export by `action` prefix to reach more.

**Several actions.** `action` is a single prefix per call &mdash; loop client-side if you need several:

```python
def entries_for_actions(fulkruma, prefixes: list[str]):
    out = []
    for p in prefixes:
        out.extend(fulkruma.audit_log.list(action=p, limit=500)["entries"])
    return sorted(out, key=lambda e: e["createdAt"], reverse=True)

key_and_webhook = entries_for_actions(fulkruma, ["api_key.", "webhook."])
```

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `403` | `NO_ACCOUNT` | The credentials resolve to no workspace. |

Unknown `action` / `target_type` values aren't errors &mdash; they match nothing and return an empty list.

## Next

- [**API keys**](/docs/sdk/python/resources/api-keys) &mdash; the most-audited resource.
- [**Webhooks**](/docs/sdk/python/resources/webhooks) &mdash; real-time events for shipments, stock and licenses (the audit log itself emits none).
- [**API &rarr; Audit log**](/docs/api/resources/audit-log) &mdash; HTTP reference, including the full action table.
