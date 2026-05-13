---
title: Webhooks
---

# Webhooks

Webhooks let Fulkruma push event notifications to your server in real time, so you don't have to poll. Use them to know when a shipment moves through carrier states, when a stock movement was logged, when a license was revoked, when a subscription changed. This page covers the `fulkruma.webhooks` namespace &mdash; the control plane for endpoint management. For HTTP fields, see [API: Webhooks](/docs/api/resources/webhooks); for the per-event payload schemas, see [Webhook events](/docs/api/webhooks/events/fulkruma.product.created).

## Namespace

`fulkruma.webhooks` &mdash; every method:

```ts
fulkruma.webhooks.listEndpoints()
fulkruma.webhooks.createEndpoint(input)
fulkruma.webhooks.updateEndpoint(id, patch)
fulkruma.webhooks.deleteEndpoint(id)
fulkruma.webhooks.listEvents(params?)
```

Five methods. Four manage delivery endpoints; one (`listEvents`) reads the cursor-paginated event ledger &mdash; useful for catching up after a downtime or backfilling state.

## Methods

### `webhooks.createEndpoint`

**Signature.** `fulkruma.webhooks.createEndpoint(input): Promise<{ endpoint: Record<string, unknown> }>`

Registers a URL to receive event deliveries. Optionally narrow the event types (default: all). The response includes the endpoint's signing secret &mdash; **this is the only call that returns it**. The SDK auto-mints an `Idempotency-Key`.

```ts
const { endpoint } = await fulkruma.webhooks.createEndpoint({
  url: 'https://your-app.example.com/webhooks/fulkruma',
  events: [
    'fulkruma.shipment.updated',
    'fulkruma.shipment.delivered',
    'fulkruma.license.issued',
  ],
  description: 'Production receiver',
});

const e = endpoint as { id: string; signingSecret: string };
console.log(e.id, e.signingSecret);  // STASH signingSecret NOW
```

<blockquote class="callout-warn">

**The signing secret appears once.** Just like API keys, the webhook signing secret is only returned on create. You'll use it to verify the `X-Fulkruma-Signature` header on every inbound delivery (see [Verifying webhooks](/docs/api/webhooks/events/fulkruma.product.created#verifying)). Store it before the function returns.

</blockquote>

### `webhooks.listEndpoints`

**Signature.** `fulkruma.webhooks.listEndpoints(): Promise<{ endpoints: Array<Record<string, unknown>> }>`

Returns every endpoint in the workspace. `signingSecret` is **not** included; only `create` returns it.

```ts
const { endpoints } = await fulkruma.webhooks.listEndpoints();
for (const e of endpoints as Array<{ id: string; url: string; active: boolean }>) {
  console.log(e.id, e.url, e.active ? 'active' : 'paused');
}
```

### `webhooks.updateEndpoint`

**Signature.** `fulkruma.webhooks.updateEndpoint(id, patch): Promise<{ endpoint: Record<string, unknown> }>`

PATCH semantics. Pass `active: false` to pause delivery without deleting the endpoint &mdash; useful during maintenance windows.

```ts
await fulkruma.webhooks.updateEndpoint('whe_01HX...', { active: false });
// ... maintenance ...
await fulkruma.webhooks.updateEndpoint('whe_01HX...', { active: true });
```

You can also rewrite the URL or the events list:

```ts
await fulkruma.webhooks.updateEndpoint('whe_01HX...', {
  url: 'https://new-app.example.com/webhooks/fulkruma',
  events: ['fulkruma.shipment.updated', 'fulkruma.shipment.delivered'],
});
```

### `webhooks.deleteEndpoint`

**Signature.** `fulkruma.webhooks.deleteEndpoint(id): Promise<{ deleted: boolean }>`

Hard-deletes the endpoint. In-flight deliveries (already accepted by our delivery worker) may still arrive briefly after; new events stop being queued immediately.

```ts
await fulkruma.webhooks.deleteEndpoint('whe_01HX...');
```

### `webhooks.listEvents`

**Signature.** `fulkruma.webhooks.listEvents(params?): Promise<{ events: Array<Record<string, unknown>>; nextCursor?: string }>`

Cursor-paginated read of every event emitted in the workspace, regardless of whether any endpoint successfully received it. Filters: `limit` (default 25, max 100), `cursor`, `type` (event type).

```ts
const { events, nextCursor } = await fulkruma.webhooks.listEvents({
  limit: 100,
  type: 'fulkruma.shipment.delivered',
});
```

Use this to:
- backfill after your receiver was down,
- replay an event for debugging,
- audit "did we actually emit X?".

## Types

```ts
interface WebhookEndpoint {
  id: string;              // 'whe_...'
  accountId: string;
  url: string;
  events: string[];        // [] means "all events"
  description: string | null;
  active: boolean;
  signingSecret?: string;  // only on create
  createdAt: string;
}

interface WebhookEvent {
  id: string;              // 'evt_...'
  accountId: string;
  type: string;            // 'fulkruma.shipment.updated' etc.
  payload: Record<string, unknown>;  // event-type-specific
  createdAt: string;
}
```

For the full event-type catalog and per-type payload schemas, see [Webhook events](/docs/api/webhooks/events/fulkruma.product.created) (overview links to each specific event page).

## Common patterns

### Register at deploy time

If you provision endpoints via IaC, run create + stash the secret atomically:

```ts
async function ensureEndpoint(url: string, events: string[]) {
  const { endpoints } = await fulkruma.webhooks.listEndpoints();
  const existing = (endpoints as any[]).find((e) => e.url === url);
  if (existing) return existing;
  const { endpoint } = await fulkruma.webhooks.createEndpoint({ url, events });
  const e = endpoint as { id: string; signingSecret: string };
  await secretManager.put(`FULKRUMA_WEBHOOK_SECRET/${e.id}`, e.signingSecret);
  return endpoint;
}
```

### Verify inbound deliveries

The SDK ships a `verifyWebhook` helper (see [Verifying](/docs/sdk/node/verifying-webhooks)). Sketch:

```ts
import { verifyWebhook } from '@forjio/fulkruma-node';
import express from 'express';

const app = express();
app.post('/webhooks/fulkruma', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = verifyWebhook({
      payload: req.body,                            // raw Buffer
      signature: req.header('X-Fulkruma-Signature')!,
      timestamp: req.header('X-Fulkruma-Timestamp')!,
      secret: process.env.FULKRUMA_WEBHOOK_SECRET!,
    });
    // event is the typed delivery; handle by type
    res.status(200).end();
  } catch (err) {
    res.status(400).end();
  }
});
```

### Pause-replay-resume during a release

For a risky deploy you want to ingest events synchronously:

```ts
// 1. Pause
await fulkruma.webhooks.updateEndpoint('whe_01HX...', { active: false });

// 2. Deploy your new handler.

// 3. Catch up on missed events from the ledger
const cutoff = '2026-05-13T10:00:00Z';
const { events } = await fulkruma.webhooks.listEvents({ limit: 100 });
const since = events.filter((e: any) => e.createdAt >= cutoff);
for (const e of since) await handleManually(e);

// 4. Resume
await fulkruma.webhooks.updateEndpoint('whe_01HX...', { active: true });
```

### Per-environment endpoints

Provision separate endpoints per environment so prod events never hit staging:

```ts
await fulkruma.webhooks.createEndpoint({
  url: 'https://staging.your-app.example.com/webhooks/fulkruma',
  description: 'staging',
});
await fulkruma.webhooks.createEndpoint({
  url: 'https://prod.your-app.example.com/webhooks/fulkruma',
  description: 'prod',
});
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Bad URL (must be HTTPS), unknown event type, too many events. |
| `not_found` | 404 | Endpoint or event ID missing. |
| `conflict` | 409 | Same URL already registered. |
| `forbidden` | 403 | Key lacks `fulkruma:webhook:write` scope. |

## Next

- [Verifying webhooks](/docs/sdk/node/verifying-webhooks) &mdash; how to use the `verifyWebhook` helper.
- [Webhook events overview](/docs/api/webhooks/events/fulkruma.product.created) &mdash; per-event payload schemas.
- [Audit log](/docs/sdk/node/resources/audit-log) &mdash; complementary on-side ledger of actions.
- [API: Webhooks](/docs/api/resources/webhooks) &mdash; HTTP reference.
