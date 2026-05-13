---
title: Audit log
---

# Audit log

The **audit log** is the append-only ledger of every meaningful action taken in a workspace &mdash; key mints, key revocations, stock adjustments, shipment bookings, integration toggles, plan changes. It's the same data the portal's "Activity" page renders, and the same data you'd hand to a compliance reviewer asking "who did what when?". This page covers the `fulkruma.auditLog` namespace. For HTTP fields, see [API: Audit log](/docs/api/resources/audit-log).

## Namespace

`fulkruma.auditLog` &mdash; every method:

```ts
fulkruma.auditLog.list(params?)
```

One method. Audit entries are write-only from the system's side &mdash; you can't `create` or `delete` them via the SDK by design.

## Methods

### `auditLog.list`

**Signature.** `fulkruma.auditLog.list(params?): Promise<{ entries: Array<Record<string, unknown>>; nextCursor?: string }>`

Returns audit entries newest-first, cursor-paginated. Filters: `limit` (default 25, max 100), `cursor`, `since` (ISO-8601, exclusive), `eventType` (exact-match on the audit event type).

```ts
const { entries, nextCursor } = await fulkruma.auditLog.list({
  limit: 50,
  since: '2026-05-01T00:00:00Z',
  eventType: 'apikey.created',
});

for (const e of entries as Array<{ eventType: string; actorId: string; createdAt: string; payload: any }>) {
  console.log(e.createdAt, e.actorId, e.eventType, JSON.stringify(e.payload));
}

if (nextCursor) {
  const more = await fulkruma.auditLog.list({ cursor: nextCursor, limit: 50 });
}
```

Common `eventType` values:

- `apikey.created` / `apikey.revoked`
- `warehouse.created` / `warehouse.updated` / `warehouse.archived`
- `product.created` / `product.updated` / `product.archived`
- `stock.adjusted`
- `shipment.created`
- `license.issued` / `license.revoked`
- `delivery.created`
- `integration.connected` / `integration.disconnected`
- `subscription.changed`

The full vocabulary lives in [API: Audit log](/docs/api/resources/audit-log#event-types).

## Types

```ts
interface AuditEntry {
  id: string;
  accountId: string;
  actorId: string;           // huudis user id or 'system'
  actorType: 'user' | 'apikey' | 'system';
  eventType: string;
  payload: Record<string, unknown>;  // event-type-specific
  requestId: string | null;  // tie back to the request that caused it
  createdAt: string;
}
```

`payload` shapes vary by `eventType` &mdash; treat as unknown-typed and pick fields out at the per-type call site. See [API: Audit log](/docs/api/resources/audit-log#payloads) for the per-event schema.

## Common patterns

### Tail the most recent activity

For a "what just happened?" pane:

```ts
const { entries } = await fulkruma.auditLog.list({ limit: 25 });
return entries.slice(0, 25);  // already newest-first
```

### Walk the full ledger

For an export-to-CSV job:

```ts
async function* allEntries(since?: string) {
  let cursor: string | undefined;
  while (true) {
    const { entries, nextCursor } = await fulkruma.auditLog.list({
      limit: 100, cursor, since,
    });
    for (const e of entries) yield e;
    if (!nextCursor) return;
    cursor = nextCursor;
  }
}

for await (const e of allEntries('2026-01-01T00:00:00Z')) {
  writeRow(e);
}
```

### Filter on event type

For a security review focused on key management:

```ts
const sensitive = ['apikey.created', 'apikey.revoked', 'integration.connected'];
for (const type of sensitive) {
  const { entries } = await fulkruma.auditLog.list({ limit: 100, eventType: type });
  console.log(type, entries.length, 'recent');
}
```

You can only pass one `eventType` per call &mdash; loop client-side if you need multiple.

### Tie to a request ID

When investigating a customer issue, find every audit entry from a specific request:

```ts
async function entriesForRequest(requestId: string) {
  const { entries } = await fulkruma.auditLog.list({ limit: 100 });
  return entries.filter((e) => (e as any).requestId === requestId);
}
```

Every Fulkruma response carries `meta.requestId`; the audit log copies it onto every entry that request generated. Same `requestId` &rarr; same upstream call.

### Reconcile against your own logs

If your service also keeps an audit trail, you can cross-check against Fulkruma's by `actorId` + time window:

```ts
async function reconcile(actorId: string, fromIso: string) {
  const { entries } = await fulkruma.auditLog.list({ limit: 100, since: fromIso });
  return entries.filter((e) => (e as any).actorId === actorId);
}
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Bad `since` format, `limit` out of range. |
| `forbidden` | 403 | Key lacks `fulkruma:auditlog:read` scope. |

The audit log can't 404 individual entries &mdash; the SDK only exposes list. Use the filters to narrow down.

## Next

- [API keys](/docs/sdk/node/resources/api-keys) &mdash; the most-audited resource.
- [Webhooks](/docs/sdk/node/resources/webhooks) &mdash; subscribe to `fulkruma.audit.created` for real-time monitoring.
- [API: Audit log](/docs/api/resources/audit-log) &mdash; HTTP reference, including the full `eventType` and `payload` catalog.
