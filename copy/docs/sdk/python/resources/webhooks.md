---
title: Webhooks
---

# Webhooks

Webhooks let Fulkruma push event notifications to your server in real time, so you don't have to poll. Use them to know when a shipment moves through carrier states, when a stock movement was logged, when a license was issued or revoked. The Python SDK wraps five endpoints behind `fulkruma.webhooks`. For HTTP shapes, see [**API &rarr; Webhooks**](/docs/api/resources/webhooks); for the per-event payload schemas, see [**Webhook events**](/docs/api/webhooks/events/fulkruma.product.created).

## Namespace

```python
fulkruma.webhooks     # WebhooksResources
```

Five methods. Four manage delivery endpoints; one (`list_events`) reads the most recent delivery records.

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

Hard-deletes the endpoint. In-flight deliveries (already accepted by our delivery worker) may still arrive briefly after; new events stop being queued immediately.

```python
fulkruma.webhooks.delete_endpoint("whe_01HX...")
```

### `list_events`

```python
fulkruma.webhooks.list_events(*, on_behalf_of: str | None = None) -> dict
```

The workspace's 50 most recent delivery records, newest first: `{"events": [...]}`, one per event per endpoint, with its delivery `status` (`pending`, `sent`, `failed`), `attempts` and the receiver's `responseCode`. It takes no filters and has no pagination; filter the rows yourself.

```python
events = fulkruma.webhooks.list_events()["events"]
failed = [e for e in events if e["status"] == "failed"]
```

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
    "secretPreview": "whsec_…abcd",     # list only
    "createdAt": "...",
    "updatedAt": "...",
}

# delivery record (list_events)
{
    "id": "...",
    "accountId": "...",
    "endpointId": "...",
    "type": "fulkruma.shipment.status_updated.v1",
    "payload": {...},                   # the event envelope sent
    "status": "pending" | "sent" | "failed",
    "attempts": 1,
    "lastAttemptAt": "..." | None,
    "nextRetryAt": "..." | None,
    "responseCode": 200 | None,
    "responseBody": "..." | None,
    "createdAt": "...",
    "updatedAt": "...",
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

**Pause-replay-resume during a release.** For a risky deploy you want to ingest events synchronously:

```python
# 1. Pause
fulkruma.webhooks.update_endpoint("whe_01HX...", {"active": False})

# 2. Deploy your new handler.

# 3. Catch up on what was queued meanwhile (the 50 most recent deliveries)
cutoff = "2026-05-13T10:00:00Z"
result = fulkruma.webhooks.list_events()
since = [e for e in result["events"] if e["createdAt"] >= cutoff]
for e in since:
    handle_manually(e["payload"])

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
| `400` | `VALIDATION` | `url` isn't a URL, or `events` is an empty list. |
| `403` | `NO_ACCOUNT` | The credentials resolve to no workspace. |
| `404` | `NOT_FOUND` | No endpoint with that ID in this workspace (update / delete). |

## Next

- [**Webhook events overview**](/docs/api/webhooks/events/fulkruma.product.created) &mdash; per-event payload schemas.
- [**Audit log**](/docs/sdk/python/resources/audit-log) &mdash; complementary on-side ledger of actions.
- [**API &rarr; Webhooks**](/docs/api/resources/webhooks) &mdash; HTTP reference.
