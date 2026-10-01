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
fulkruma.webhooks.getEvent(id)
fulkruma.webhooks.retryEvent(id)
```

Seven methods. Four manage delivery endpoints; three read and act on the delivery log &mdash; what Fulkruma sent, what your server answered, every retry.

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

PATCH semantics. Pass `active: false` to pause delivery without deleting the endpoint: deliveries still queued for it become `failed`, and events raised while it is paused are not queued for it. `active: true` re-enables it &mdash; also after Fulkruma switched it off for failing &mdash; and clears its failure streak (`consecutiveFailures`, `failingSince`, `disabledAt`, `disabledReason`). A new `url` is checked like on create (https, no private addresses); the secret stays the same.

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

Hard-deletes the endpoint and its delivery log. A request already in flight may still arrive; nothing new is queued for it.

```ts
await fulkruma.webhooks.deleteEndpoint('whe_01HX...');
```

### `webhooks.listEvents`

**Signature.** `fulkruma.webhooks.listEvents(params?: { limit?: number; cursor?: string; type?: string; status?: 'pending' | 'sent' | 'failed'; endpointId?: string }): Promise<{ events: WebhookDelivery[]; nextCursor: string | null }>`

The delivery log, newest first &mdash; one row per event per endpoint, with its `status` (`pending`: queued or waiting for a retry at `nextRetryAt`; `sent`: your endpoint answered 2xx; `failed`: given up), `attempts`, the last `responseCode` / `lastError`, and every attempt made (`deliveryAttempts`). `limit` is 1&ndash;200 (default 50); pass `nextCursor` back as `cursor` for the next page.

```ts
// Everything that gave up on one endpoint, page by page.
let cursor: string | undefined;
do {
  const page = await fulkruma.webhooks.listEvents({ endpointId: 'clx8n4…', status: 'failed', limit: 100, cursor });
  for (const d of page.events) console.log(d.eventId, d.type, d.lastError);
  cursor = page.nextCursor ?? undefined;
} while (cursor);
```

### `webhooks.getEvent`

**Signature.** `fulkruma.webhooks.getEvent(id): Promise<{ event: WebhookDelivery }>`

One delivery with every attempt made at it.

### `webhooks.retryEvent`

**Signature.** `fulkruma.webhooks.retryEvent(id): Promise<{ event: WebhookDelivery }>`

Queues one more attempt now &mdash; a `failed` delivery once your handler is fixed, or a `sent` one to send again. The server answers `202` with the row in `pending`; the attempt goes out within seconds, so read it back with `getEvent`. Fails with `409` (`ALREADY_QUEUED`, `ENDPOINT_DISABLED`) when the delivery is already queued or its endpoint is off.

```ts
const { events } = await fulkruma.webhooks.listEvents({ status: 'failed' });
for (const d of events) await fulkruma.webhooks.retryEvent(d.id);
```

## Types

```ts
interface WebhookEndpoint {          // listEndpoints / updateEndpoint rows (Record<string, unknown> in the SDK)
  id: string;
  accountId: string;
  url: string;
  events: string[];        // ["*"] means every event; "fulkruma.shipment.*" a prefix
  description: string | null;
  active: boolean;
  consecutiveFailures: number;     // failed attempts in a row since the last 2xx
  failingSince: string | null;     // start of the current failure streak
  disabledAt: string | null;       // set when Fulkruma switched it off for failing
  disabledReason: string | null;
  secretPreview: string | null;    // list only: 'whsec_…' + last 4
  createdAt: string;
  updatedAt: string;
}

// Exported by the SDK.
interface WebhookDelivery {
  id: string;
  accountId: string;
  endpointId: string;
  eventId: string;         // the envelope's evt_… id, the same on every attempt
  type: string;            // e.g. 'fulkruma.shipment.status_updated.v1'
  payload: WebhookEventEnvelope;   // the body sent
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  responseCode: number | null;     // null when no response came back
  responseBody: string | null;     // first 2 KiB of the last response
  lastError: string | null;        // 'HTTP 503', 'timed out after 10000ms', 'blocked: …'
  durationMs: number | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  deliveryAttempts: WebhookDeliveryAttempt[];   // oldest first
}

interface WebhookDeliveryAttempt {
  id: string;
  webhookEventId: string;
  accountId: string;
  endpointId: string;
  attemptNumber: number;
  status: 'succeeded' | 'failed';
  responseCode: number | null;
  durationMs: number;
  error: string | null;
  nextRetryAt: string | null;      // the retry this failure scheduled
  attemptedAt: string;
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

### Riding out a deploy, and catching up afterwards

You don't need to pause an endpoint for a deploy: a failed delivery is retried 1 min, 5 min, 25 min, 2 h and 12 h later, so a receiver that is down for a while still gets everything. Pausing (`active: false`) is for stopping deliveries altogether &mdash; events raised while paused are not queued for that endpoint.

If deliveries did give up (or Fulkruma switched the endpoint off after it kept failing), re-enable it and retry what failed:

```ts
await fulkruma.webhooks.updateEndpoint('clx8n4…', { active: true });
let cursor: string | undefined;
do {
  const page = await fulkruma.webhooks.listEvents({ endpointId: 'clx8n4…', status: 'failed', cursor });
  for (const d of page.events) await fulkruma.webhooks.retryEvent(d.id);
  cursor = page.nextCursor ?? undefined;
} while (cursor);
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
| `VALIDATION` | 400 | `url` isn't a URL Fulkruma will call (not https, or a private / loopback / link-local address &mdash; the message says which), or `events` is empty or holds something other than `"*"`, an event type or a `"fulkruma.….*"` prefix. |
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |
| `NOT_FOUND` | 404 | No endpoint (update / delete) or delivery (getEvent / retryEvent) with that ID in this workspace. |
| `ALREADY_QUEUED` | 409 | `retryEvent` on a delivery that is already `pending`. |
| `ENDPOINT_DISABLED` | 409 | `retryEvent` while the delivery's endpoint is paused or switched off. |

## Next

- [Webhook events overview](/docs/api/webhooks/events/fulkruma.product.created) &mdash; per-event payload schemas.
- [Audit log](/docs/sdk/node/resources/audit-log) &mdash; complementary on-side ledger of actions.
- [API: Webhooks](/docs/api/resources/webhooks) &mdash; HTTP reference.
