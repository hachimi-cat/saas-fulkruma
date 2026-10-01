---
title: fulkruma.webhook_endpoint.disabled
---

# `fulkruma.webhook_endpoint.disabled.v1`

Fires when Fulkruma switches off one of your webhook endpoints because it kept failing. It goes to your **other** endpoints that subscribe to it &mdash; the switched-off one receives nothing more &mdash; so subscribe a second, independent endpoint (an alerting service, a different host) to hear about the first going dark.

## When it fires

When an endpoint has failed **20 attempts in a row** and has been failing for **at least 24 hours**, the delivery worker sets it `active: false` with `disabledAt` and `disabledReason`, marks its queued deliveries `failed`, records a `webhook.auto_disabled` [audit-log](/docs/api/resources/audit-log) entry and writes this event, in the same transaction. Exactly once per switch-off.

Pausing an endpoint yourself (`PATCH /api/v1/webhooks/endpoints/{id}` with `active: false`) fires nothing.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.webhook_endpoint.disabled.v1",
  "occurredAt": "2026-05-13T11:02:41.007Z",
  "accountId": "acc_01HX...",
  "data": {
    "id": "clx0webhookendpoint",
    "url": "https://example.com/webhooks/fulkruma",
    "description": "Order sync",
    "disabledAt": "2026-05-13T11:02:41.005Z",
    "disabledReason": "20 consecutive failed deliveries since 2026-05-12T09:14:03.410Z",
    "consecutiveFailures": 20,
    "failingSince": "2026-05-12T09:14:03.410Z"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | The endpoint switched off. |
| `url` | string | Its URL. |
| `description` | string \| null | Its description. |
| `disabledAt` | string (ISO 8601 UTC) | When it was switched off. |
| `disabledReason` | string | Why, as stored on the endpoint. |
| `consecutiveFailures` | integer | Failed attempts in a row at that moment. |
| `failingSince` | string (ISO 8601 UTC) | When the run of failures started. |

## Handler examples

```js
// Node
if (event.type === 'fulkruma.webhook_endpoint.disabled.v1') {
  const { id, url, disabledReason } = event.data;
  await pager.alert(`Fulkruma switched off webhook ${id} (${url}): ${disabledReason}`);
}
```

```python
# Python
if event["type"] == "fulkruma.webhook_endpoint.disabled.v1":
    d = event["data"]
    pager.alert(f"Fulkruma switched off webhook {d['id']} ({d['url']}): {d['disabledReason']}")
```

```go
// Go
if event.Type == "fulkruma.webhook_endpoint.disabled.v1" {
    var d struct{ ID, URL, DisabledReason string }
    _ = json.Unmarshal(event.Data, &d)
    pager.Alert(ctx, d.ID, d.URL, d.DisabledReason)
}
```

## What to do

1. Fix the receiver at `url`.
2. Re-enable the endpoint: `PATCH /api/v1/webhooks/endpoints/{id}` with `{"active": true}` (this also resets its failure streak).
3. Retry what it missed: `GET /api/v1/webhooks/events?endpointId={id}&status=failed`, then [retry](/docs/api/resources/webhooks#retry-a-delivery) each (`POST /api/v1/webhooks/events/{id}/retry`).

## Common pitfalls

- **Subscribing only the endpoint that might fail.** It cannot tell you about itself. Use a second endpoint, or watch `active` on [List endpoints](/docs/api/resources/webhooks#list-endpoints) or the audit log.
- **Re-enabling before the receiver works.** The streak starts over, but the next failures count towards another switch-off.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks) &mdash; retries, the delivery log, switch-off rules.
- [**Audit log**](/docs/api/resources/audit-log) &mdash; the `webhook.auto_disabled` entry.
