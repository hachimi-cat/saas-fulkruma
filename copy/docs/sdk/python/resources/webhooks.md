---
title: Webhooks
---

# Webhooks

Webhooks let Fulkruma push event notifications to your server in real time, so you don't have to poll. Use them to know when a shipment moves through carrier states, when a stock movement was logged, when a license was issued or revoked. The Python SDK wraps seven endpoints behind `fulkruma.webhooks`. For HTTP shapes, see [**API &rarr; Webhooks**](/docs/api/resources/webhooks); for the per-event payload schemas, see [**Webhook events**](/docs/api/webhooks/events/fulkruma.product.created).

## Namespace

```python
fulkruma.webhooks     # WebhooksResources
```

Seven methods. Four manage delivery endpoints (`create_endpoint`, `list_endpoints`, `update_endpoint`, `delete_endpoint`); three read and act on the delivery log &mdash; what Fulkruma sent, what your server answered, every retry (`list_events`, `get_event`, `retry_event`).

## Methods

### `create_endpoint`

```python
fulkruma.webhooks.create_endpoint(body: dict, *, on_behalf_of: str | None = None) -> dict
```

Registers a URL to receive event deliveries. `events` narrows the types (`["*"]`, every event, when omitted); patterns like `"fulkruma.shipment.*"` are allowed. The result is `{"endpoint": {...}, "secret": "whsec_..."}` &mdash; **this is the only call that returns the secret**. The SDK auto-mints an idempotency key.

```python
result = fulkruma.webhooks.create_endpoint({
    "url": "https://your-app.example.com/webhooks/fulkruma",
    "events": ["fulkruma.shipment.*", "fulkruma.license.issued.v1"],
    "description": "Production receiver",
})

print(result["endpoint"]["id"])
secret = result["secret"]   # STASH NOW
```

<blockquote class="callout-warn">

**The signing secret appears once.** Just like API keys, the webhook signing secret is only returned on create. You'll use it to verify the `Fulkruma-Signature` header on every inbound delivery (see **Verify inbound deliveries** below). Store it before the function returns.

</blockquote>

### `list_endpoints`

```python
fulkruma.webhooks.list_endpoints(*, on_behalf_of: str | None = None) -> dict
```

Returns every endpoint in the workspace, newest first. The secret is **not** included &mdash; only a `secretPreview` (`whsec_…` plus its last 4 characters); `create_endpoint` alone returns the secret.

```python
result = fulkruma.webhooks.list_endpoints()
for e in result["endpoints"]:
    state = "active" if e.get("active") else "paused"
    print(e["id"], e["url"], state)
```

### `update_endpoint`

```python
fulkruma.webhooks.update_endpoint(
    endpoint_id: str,
    patch: dict,
    *,
    on_behalf_of: str | None = None,
) -> dict
```

PATCH semantics. Pass `{"active": False}` to pause delivery without deleting the endpoint: deliveries still queued for it become `failed`, and events raised while it is paused are not queued for it. `{"active": True}` re-enables it &mdash; also after Fulkruma switched it off for failing &mdash; and clears its failure streak (`consecutiveFailures`, `failingSince`, `disabledAt`, `disabledReason`). A new `url` is checked like on create (https, no private addresses); the secret stays the same.

```python
fulkruma.webhooks.update_endpoint("whe_01HX...", {"active": False})
# ... maintenance ...
fulkruma.webhooks.update_endpoint("whe_01HX...", {"active": True})
```

You can also rewrite the URL or the events list:

```python
fulkruma.webhooks.update_endpoint("whe_01HX...", {
    "url": "https://new-app.example.com/webhooks/fulkruma",
    "events": ["fulkruma.shipment.status_updated.v1", "fulkruma.shipment.cancelled.v1"],
})
```

### `delete_endpoint`

```python
fulkruma.webhooks.delete_endpoint(
    endpoint_id: str,
    *,
    on_behalf_of: str | None = None,
) -> dict
```

Hard-deletes the endpoint and its delivery log. A request already in flight may still arrive; nothing new is queued for it.

```python
fulkruma.webhooks.delete_endpoint("whe_01HX...")
```

### `list_events`

```python
fulkruma.webhooks.list_events(
    *,
    limit: int | None = None,          # 1-200, default 50
    cursor: str | None = None,         # the previous page's nextCursor
    type: str | None = None,           # e.g. "fulkruma.shipment.created.v1"
    status: str | None = None,         # "pending" | "sent" | "failed"
    endpoint_id: str | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

The delivery log, newest first: `{"events": [...], "nextCursor": str | None}` &mdash; one row per event per endpoint, with its `status` (`pending`: queued or waiting for a retry at `nextRetryAt`; `sent`: your endpoint answered 2xx; `failed`: given up), `attempts`, the last `responseCode` / `lastError`, and every attempt made (`deliveryAttempts`).

```python
cursor = None
while True:
    page = fulkruma.webhooks.list_events(status="failed", limit=100, cursor=cursor)
    for d in page["events"]:
        print(d["eventId"], d["type"], d["lastError"])
    cursor = page["nextCursor"]
    if not cursor:
        break
```

### `get_event`

```python
fulkruma.webhooks.get_event(delivery_id: str, *, on_behalf_of: str | None = None) -> dict
```

One delivery with every attempt made at it: `{"event": {...}}`.

### `retry_event`

```python
fulkruma.webhooks.retry_event(delivery_id: str, *, on_behalf_of: str | None = None) -> dict
```

Queues one more attempt now &mdash; a `failed` delivery once your handler is fixed, or a `sent` one to send again. The server answers `202` with the row in `pending`; the attempt goes out within seconds, so read it back with `get_event`. Raises `FulkrumaError` with status `409` (`ALREADY_QUEUED`, `ENDPOINT_DISABLED`) when the delivery is already queued or its endpoint is off.

## Types

```python
# endpoint
{
    "id": "...",
    "accountId": "...",
    "url": "https://...",
    "events": ["*"],                    # ["*"] means every event
    "description": "..." | None,
    "active": bool,
    "consecutiveFailures": 0,           # failed attempts in a row since the last 2xx
    "failingSince": "..." | None,       # start of the current failure streak
    "disabledAt": "..." | None,         # set when Fulkruma switched it off for failing
    "disabledReason": "..." | None,
    "secretPreview": "whsec_…abcd",     # list only
    "createdAt": "...",
    "updatedAt": "...",
}

# delivery (list_events / get_event / retry_event)
{
    "id": "...",
    "accountId": "...",
    "endpointId": "...",
    "eventId": "evt_...",               # the envelope's id, the same on every attempt
    "type": "fulkruma.shipment.status_updated.v1",
    "payload": {...},                   # the event envelope sent
    "status": "pending" | "sent" | "failed",
    "attempts": 1,
    "lastAttemptAt": "..." | None,
    "nextRetryAt": "..." | None,
    "responseCode": 200 | None,         # None when no response came back
    "responseBody": "..." | None,       # first 2 KiB of the last response
    "lastError": "HTTP 503" | None,     # or "timed out after 10000ms", "blocked: ..."
    "durationMs": 87 | None,
    "deliveredAt": "..." | None,
    "createdAt": "...",
    "updatedAt": "...",
    "deliveryAttempts": [               # oldest first
        {"attemptNumber": 1, "status": "succeeded" | "failed", "responseCode": 200 | None,
         "durationMs": 87, "error": None, "nextRetryAt": None, "attemptedAt": "...", ...},
    ],
}
```

For the full event-type catalog and per-type payload schemas, see [**Webhook events**](/docs/api/webhooks/events/fulkruma.product.created).

## Common patterns

**Register at deploy time.** If you provision endpoints via IaC, run create + stash the secret atomically:

```python
def ensure_endpoint(fulkruma, url: str, events: list, secret_manager) -> dict:
    result = fulkruma.webhooks.list_endpoints()
    existing = next((e for e in result["endpoints"] if e["url"] == url), None)
    if existing:
        return existing
    created = fulkruma.webhooks.create_endpoint({"url": url, "events": events})
    endpoint = created["endpoint"]
    secret_manager.put(f"FULKRUMA_WEBHOOK_SECRET/{endpoint['id']}", created["secret"])
    return endpoint
```

**Verify inbound deliveries.** The SDK ships a `verify_webhook` helper. It checks the `Fulkruma-Signature: t=<unix>,v1=<hex>` header &mdash; an HMAC-SHA256 of `<t>.<raw body>` with the endpoint's secret &mdash; and rejects a timestamp more than 5 minutes off:

```python
import os
from flask import Flask, request, abort
from fulkruma import verify_webhook, FulkrumaError

app = Flask(__name__)

@app.post("/webhooks/fulkruma")
def fulkruma_webhook():
    try:
        event = verify_webhook(
            raw_body=request.get_data(),
            signature=request.headers.get("Fulkruma-Signature"),
            secret=os.environ["FULKRUMA_WEBHOOK_SECRET"],
        )
    except FulkrumaError:
        abort(400)
    # event is the typed delivery; handle by type
    return "", 200
```

**Riding out a deploy, and catching up afterwards.** You don't need to pause an endpoint for a deploy: a failed delivery is retried 1 min, 5 min, 25 min, 2 h and 12 h later, so a receiver that is down for a while still gets everything. Pausing (`{"active": False}`) stops deliveries altogether &mdash; events raised while paused are not queued for that endpoint. If deliveries did give up (or Fulkruma switched the endpoint off after it kept failing), re-enable it and retry what failed:

```python
fulkruma.webhooks.update_endpoint("whe_01HX...", {"active": True})
cursor = None
while True:
    page = fulkruma.webhooks.list_events(endpoint_id="whe_01HX...", status="failed", cursor=cursor)
    for d in page["events"]:
        fulkruma.webhooks.retry_event(d["id"])
    cursor = page["nextCursor"]
    if not cursor:
        break
```

**Per-environment endpoints.** Provision separate endpoints per environment so prod events never hit staging:

```python
fulkruma.webhooks.create_endpoint({
    "url": "https://staging.your-app.example.com/webhooks/fulkruma",
    "description": "staging",
})
fulkruma.webhooks.create_endpoint({
    "url": "https://prod.your-app.example.com/webhooks/fulkruma",
    "description": "prod",
})
```

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `VALIDATION` | `url` isn't a URL Fulkruma will call (not https, or a private / loopback / link-local address &mdash; the message says which), or `events` is empty or holds something other than `"*"`, an event type or a `"fulkruma.….*"` prefix. |
| `403` | `NO_ACCOUNT` | The credentials resolve to no workspace. |
| `404` | `NOT_FOUND` | No endpoint (update / delete) or delivery (get_event / retry_event) with that ID in this workspace. |
| `409` | `ALREADY_QUEUED` | `retry_event` on a delivery that is already `pending`. |
| `409` | `ENDPOINT_DISABLED` | `retry_event` while the delivery's endpoint is paused or switched off. |

## Next

- [**Webhook events overview**](/docs/api/webhooks/events/fulkruma.product.created) &mdash; per-event payload schemas.
- [**Audit log**](/docs/sdk/python/resources/audit-log) &mdash; complementary on-side ledger of actions.
- [**API &rarr; Webhooks**](/docs/api/resources/webhooks) &mdash; HTTP reference.
