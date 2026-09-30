---
title: Webhooks
---

# Webhooks

Webhooks let Fulkruma push event notifications to your server in real time, so you don't have to poll. Use them to know when a shipment moves through carrier states, when a stock movement was logged, when a license was issued or revoked. This page covers the `fulkruma.webhooks` namespace &mdash; the control plane for endpoint management. For HTTP fields, see [API: Webhooks](/docs/api/resources/webhooks); for the per-event payload schemas, see [Webhook events](/docs/api/webhooks/events/fulkruma.product.created).

## Namespace

`fulkruma.webhooks` &mdash; every method:

```ts
fulkruma.webhooks.listEndpoints()
fulkruma.webhooks.createEndpoint(input)
fulkruma.webhooks.updateEndpoint(id, patch)
fulkruma.webhooks.deleteEndpoint(id)
fulkruma.webhooks.listEvents(params?)
```

Five methods. Four manage delivery endpoints; one (`listEvents`) reads the most recent delivery records.

## Methods

### `webhooks.createEndpoint`

**Signature.** `fulkruma.webhooks.createEndpoint(input: { url: string; events?: string[]; description?: string }): Promise<{ endpoint: Record<string, unknown>; secret: string }>`

Registers a URL to receive event deliveries. `events` narrows the types (`["*"]`, every event, when omitted); patterns like `"fulkruma.shipment.*"` are allowed. The response carries the endpoint's signing `secret` next to it &mdash; **this is the only call that returns it**. The SDK auto-mints an `Idempotency-Key`.

```ts
const { endpoint, secret } = await fulkruma.webhooks.createEndpoint({
  url: 'https://your-app.example.com/webhooks/fulkruma',
  events: ['fulkruma.shipment.*', 'fulkruma.license.issued.v1'],
  description: 'Production receiver',
});

console.log(endpoint.id);  // STASH `secret` NOW (whsec_...)
```

<blockquote class="callout-warn">

**The signing secret appears once.** Just like API keys, the webhook signing secret is only returned on create. You'll use it to verify the `Fulkruma-Signature` header on every inbound delivery (see [Verify inbound deliveries](#verify-inbound-deliveries)). Store it before the function returns.

</blockquote>

### `webhooks.listEndpoints`

**Signature.** `fulkruma.webhooks.listEndpoints(): Promise<{ endpoints: Array<Record<string, unknown>> }>`

Returns every endpoint in the workspace, newest first. The secret is **not** included &mdash; only a `secretPreview` (`whsec_…` plus its last 4 characters); `create` alone returns the secret.

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
  events: ['fulkruma.shipment.status_updated.v1', 'fulkruma.shipment.cancelled.v1'],
});
```

### `webhooks.deleteEndpoint`

**Signature.** `fulkruma.webhooks.deleteEndpoint(id): Promise<{ deleted: boolean }>`

Hard-deletes the endpoint. In-flight deliveries (already accepted by our delivery worker) may still arrive briefly after; new events stop being queued immediately.

```ts
await fulkruma.webhooks.deleteEndpoint('whe_01HX...');
```

### `webhooks.listEvents`

**Signature.** `fulkruma.webhooks.listEvents(): Promise<{ events: Array<Record<string, unknown>> }>`

The workspace's 50 most recent delivery records, newest first &mdash; one per event per endpoint, with its delivery `status` (`pending`, `sent`, `failed`), `attempts` and the receiver's `responseCode`. It takes no filters and has no pagination; filter the rows yourself.

```ts
const { events } = await fulkruma.webhooks.listEvents();
const failed = events.filter((e) => e.status === 'failed');
```

## Types

```ts
interface WebhookEndpoint {
  id: string;
  accountId: string;
  url: string;
  events: string[];        // ["*"] means every event
  description: string | null;
  active: boolean;
  secretPreview: string | null;  // list only: 'whsec_…' + last 4
  createdAt: string;
  updatedAt: string;
}

interface WebhookDelivery {
  id: string;
  accountId: string;
  endpointId: string;
  type: string;            // e.g. 'fulkruma.shipment.status_updated.v1'
  payload: Record<string, unknown>;  // the event envelope sent
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  responseCode: number | null;
  responseBody: string | null;
  createdAt: string;
  updatedAt: string;
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
  const { endpoint, secret } = await fulkruma.webhooks.createEndpoint({ url, events });
  await secretManager.put(`FULKRUMA_WEBHOOK_SECRET/${endpoint.id}`, secret);
  return endpoint;
}
```

### Verify inbound deliveries

The SDK ships a `verifyWebhook` helper. It checks the `Fulkruma-Signature: t=<unix>,v1=<hex>` header &mdash; an HMAC-SHA256 of `<t>.<raw body>` with the endpoint's secret &mdash; and rejects a timestamp more than 5 minutes off. Sketch:

```ts
import { verifyWebhook } from '@forjio/fulkruma-node';
import express from 'express';

const app = express();
app.post('/webhooks/fulkruma', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = verifyWebhook({
      rawBody: req.body,                            // raw Buffer
      signature: req.header('Fulkruma-Signature'),
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

// 3. Catch up on what was queued meanwhile (the 50 most recent deliveries)
const cutoff = '2026-05-13T10:00:00Z';
const { events } = await fulkruma.webhooks.listEvents();
const since = events.filter((e) => (e.createdAt as string) >= cutoff);
for (const e of since) await handleManually(e.payload);

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
| `VALIDATION` | 400 | `url` isn't a URL, or `events` is an empty list. |
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |
| `NOT_FOUND` | 404 | No endpoint with that ID in this workspace (update / delete). |

## Next

- [Webhook events overview](/docs/api/webhooks/events/fulkruma.product.created) &mdash; per-event payload schemas.
- [Audit log](/docs/sdk/node/resources/audit-log) &mdash; complementary on-side ledger of actions.
- [API: Webhooks](/docs/api/resources/webhooks) &mdash; HTTP reference.
