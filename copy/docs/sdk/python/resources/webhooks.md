---
title: Webhooks
---

# Webhooks

Webhooks let Fulkruma push event notifications to your server in real time, so you don't have to poll. Use them to know when a shipment moves through carrier states, when a stock movement was logged, when a license was revoked, when a subscription changed. The Python SDK wraps five endpoints behind `fulkruma.webhooks`. For HTTP shapes, see [**API &rarr; Webhooks**](/docs/api/resources/webhooks); for the per-event payload schemas, see [**Webhook events**](/docs/api/webhooks/events/fulkruma.product.created).

## Namespace

```python
fulkruma.webhooks     # WebhooksResources
```

Five methods. Four manage delivery endpoints; one (`list_events`) reads the cursor-paginated event ledger &mdash; useful for catching up after a downtime or backfilling state.

## Methods

### `create_endpoint`

```python
fulkruma.webhooks.create_endpoint(body: dict, *, on_behalf_of: str | None = None) -> dict
```

Registers a URL to receive event deliveries. Optionally narrow the event types (default: all). The response includes the endpoint's `signingSecret` &mdash; **this is the only call that returns it**. The SDK auto-mints an idempotency key.

```python
result = fulkruma.webhooks.create_endpoint({
    "url": "https://your-app.example.com/webhooks/fulkruma",
    "events": [
        "fulkruma.shipment.updated",
        "fulkruma.shipment.delivered",
        "fulkruma.license.issued",
    ],
    "description": "Production receiver",
})

e = result["endpoint"]
print(e["id"], e["signingSecret"])  # STASH signingSecret NOW
```

<blockquote class="callout-warn">

**The signing secret appears once.** Just like API keys, the webhook signing secret is only returned on create. You'll use it to verify the `X-Fulkruma-Signature` header on every inbound delivery (see [**Verifying webhooks**](/docs/sdk/python/verifying-webhooks)). Store it before the function returns.

</blockquote>

### `list_endpoints`

```python
fulkruma.webhooks.list_endpoints(*, on_behalf_of: str | None = None) -> dict
```

Returns every endpoint in the workspace. `signingSecret` is **not** included; only `create` returns it.

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

PATCH semantics. Pass `{"active": False}` to pause delivery without deleting the endpoint &mdash; useful during maintenance windows.

```python
fulkruma.webhooks.update_endpoint("whe_01HX...", {"active": False})
# ... maintenance ...
fulkruma.webhooks.update_endpoint("whe_01HX...", {"active": True})
```

You can also rewrite the URL or the events list:

```python
fulkruma.webhooks.update_endpoint("whe_01HX...", {
    "url": "https://new-app.example.com/webhooks/fulkruma",
    "events": ["fulkruma.shipment.updated", "fulkruma.shipment.delivered"],
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

Hard-deletes the endpoint. In-flight deliveries (already accepted by our delivery worker) may still arrive briefly after; new events stop being queued immediately.

```python
fulkruma.webhooks.delete_endpoint("whe_01HX...")
```

### `list_events`

```python
fulkruma.webhooks.list_events(
    *,
    limit: int | None = None,
    cursor: str | None = None,
    type: str | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Cursor-paginated read of every event emitted in the workspace, regardless of whether any endpoint successfully received it. Filters: `limit` (default 25, max 100), `cursor`, `type` (event type).

```python
result = fulkruma.webhooks.list_events(
    limit=100, type="fulkruma.shipment.delivered",
)
```

Use this to:
- backfill after your receiver was down,
- replay an event for debugging,
- audit "did we actually emit X?".

## Types

```python
# endpoint
{
    "id": "whe_...",
    "accountId": "acc_...",
    "url": "https://...",
    "events": ["fulkruma.shipment.updated", ...],  # [] means "all events"
    "description": "..." | None,
    "active": bool,
    "signingSecret": "..." | None,    # only on create
    "createdAt": "..."
}

# event
{
    "id": "evt_...",
    "accountId": "acc_...",
    "type": "fulkruma.shipment.updated",
    "payload": {...},                  # event-type-specific
    "createdAt": "..."
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
    e = created["endpoint"]
    secret_manager.put(f"FULKRUMA_WEBHOOK_SECRET/{e['id']}", e["signingSecret"])
    return e
```

**Verify inbound deliveries.** The SDK ships a `verify_webhook` helper:

```python
import os
from flask import Flask, request, abort
from fulkruma import verify_webhook, FulkrumaError

app = Flask(__name__)

@app.post("/webhooks/fulkruma")
def fulkruma_webhook():
    try:
        event = verify_webhook(
            payload=request.get_data(),
            signature=request.headers["X-Fulkruma-Signature"],
            timestamp=request.headers["X-Fulkruma-Timestamp"],
            secret=os.environ["FULKRUMA_WEBHOOK_SECRET"],
        )
    except FulkrumaError:
        abort(400)
    # event is the typed delivery; handle by type
    return "", 200
```

See [**Verifying webhooks**](/docs/sdk/python/verifying-webhooks) for the full helper.

**Pause-replay-resume during a release.** For a risky deploy you want to ingest events synchronously:

```python
# 1. Pause
fulkruma.webhooks.update_endpoint("whe_01HX...", {"active": False})

# 2. Deploy your new handler.

# 3. Catch up on missed events from the ledger
cutoff = "2026-05-13T10:00:00Z"
result = fulkruma.webhooks.list_events(limit=100)
since = [e for e in result["events"] if e["createdAt"] >= cutoff]
for e in since:
    handle_manually(e)

# 4. Resume
fulkruma.webhooks.update_endpoint("whe_01HX...", {"active": True})
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
| `400` | `validation_error` | Bad URL (must be HTTPS), unknown event type, too many events. |
| `404` | `not_found` | Endpoint or event ID missing. |
| `409` | `conflict` | Same URL already registered. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:webhook:write`. |

## Next

- [**Verifying webhooks**](/docs/sdk/python/verifying-webhooks) &mdash; how to use the `verify_webhook` helper.
- [**Webhook events overview**](/docs/api/webhooks/events/fulkruma.product.created) &mdash; per-event payload schemas.
- [**Audit log**](/docs/sdk/python/resources/audit-log) &mdash; complementary on-side ledger of actions.
- [**API &rarr; Webhooks**](/docs/api/resources/webhooks) &mdash; HTTP reference.
