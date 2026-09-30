---
title: Audit log
---

# Audit log

The **audit log** is the ledger of workspace-changing actions &mdash; key mints and revocations, product and variant changes, deliveries, webhook endpoints, shipping settings, partner provisioning. It's the same data the portal's activity view renders, and the same data you'd hand to a compliance reviewer asking "who did what when?". This page covers the `fulkruma.auditLog` namespace. For HTTP fields, see [API: Audit log](/docs/api/resources/audit-log).

## Namespace

`fulkruma.auditLog` &mdash; every method:

```ts
fulkruma.auditLog.list(params?)
```

One method. Audit entries are written by the system only &mdash; you can't `create` or `delete` them via the SDK by design.

## Methods

### `auditLog.list`

**Signature.** `fulkruma.auditLog.list(params?: { action?: string; target_type?: string; limit?: number }): Promise<{ entries: AuditEntry[] }>`

Returns audit entries newest-first. Filters:

- `action` &mdash; a **prefix** of the action name: `'api_key.'` matches `api_key.created` and `api_key.revoked`; `'product'` matches every `product.*` action.
- `target_type` &mdash; the exact resource type, e.g. `'Product'`, `'ApiKey'`.
- `limit` &mdash; default 100, max 500.

There is no cursor and no date filter: a call returns the newest `limit` entries that match. To reach further back, narrow `action` / `target_type`.

```ts
const { entries } = await fulkruma.auditLog.list({ action: 'api_key.', limit: 50 });

for (const e of entries) {
  console.log(e.createdAt, e.actorType, e.actorId, e.action, e.targetId, JSON.stringify(e.after));
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

The table of what triggers each lives in [API: Audit log](/docs/api/resources/audit-log#actions).

## Types

```ts
interface AuditEntry {
  id: string;
  accountId: string;
  actorType: 'user' | 'api_key' | 'system';
  actorId: string | null;      // Huudis user ID, or the workspace ID for an API-key call
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

`before` / `after` carry the fields the action changed and vary by action &mdash; treat them as unknown-typed and pick fields out at the per-action call site. See [API: Audit log](/docs/api/resources/audit-log#the-audit-entry-object).

## Common patterns

### Tail the most recent activity

For a "what just happened?" pane:

```ts
const { entries } = await fulkruma.auditLog.list({ limit: 25 });
return entries;  // already newest-first
```

### Export what the log holds for one resource type

For an export-to-CSV job, take the most the endpoint returns in one call:

```ts
const { entries } = await fulkruma.auditLog.list({ target_type: 'Product', limit: 500 });
for (const e of entries) writeRow(e);
```

If a resource type has more than 500 entries, only the newest 500 come back; split the export by `action` prefix to reach more.

### Filter on action

For a security review focused on key management:

```ts
const { entries } = await fulkruma.auditLog.list({ action: 'api_key.', limit: 500 });
const minted = entries.filter((e) => e.action === 'api_key.created').length;
console.log(`${minted} keys minted, ${entries.length - minted} revoked (newest 500)`);
```

### Reconcile against your own logs

If your service also keeps an audit trail, you can cross-check against Fulkruma's by `actorId` + time window:

```ts
async function reconcile(actorId: string, fromIso: string) {
  const { entries } = await fulkruma.auditLog.list({ limit: 500 });
  return entries.filter((e) => e.actorId === actorId && e.createdAt >= fromIso);
}
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |

Unknown `action` / `target_type` values aren't errors &mdash; they match nothing and return an empty list.

## Next

- [API keys](/docs/sdk/node/resources/api-keys) &mdash; the most-audited resource.
- [Webhooks](/docs/sdk/node/resources/webhooks) &mdash; real-time events for shipments, stock and licenses (the audit log itself emits none).
- [API: Audit log](/docs/api/resources/audit-log) &mdash; HTTP reference, including the full action table.
