---
title: fulkruma.delivery.expired
---

# `fulkruma.delivery.expired.v1`

Fires when a digital delivery's download window closes &mdash; its `expiresAt` passed, or the merchant revoked it (which sets `expiresAt` to now).

## When it fires

Within about a minute of the expiry: a sweep finds deliveries whose window has closed and announces each once. [Extending](/docs/api/resources/deliveries) a delivery re-opens it, and its next expiry is announced again. Deliveries that expired before this event existed are not announced.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.delivery.expired.v1",
  "occurredAt": "2026-05-20T03:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "deliveryId": "clx6d5e4f0000aa1b2c3d4e5f",
    "productId": "prod_01HX...",
    "customerId": "cus_01HX...",
    "checkoutSessionId": "cs_01HX...",
    "expiresAt": "2026-05-20T02:59:30.000Z",
    "downloadCount": 2,
    "maxDownloads": 5
  },
  "metadata": {}
}
```

A revoke also sends [`fulkruma.delivery.updated.v1`](./fulkruma.delivery.updated) (`action: "revoke"`) at once; this event follows from the sweep.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.delivery.expired.v1') {
  await sync(event.data.deliveryId);
}
```

```python
# Python
if event["type"] == "fulkruma.delivery.expired.v1":
    sync(event["data"]["deliveryId"])
```

## Related events

- [`fulkruma.delivery.updated.v1`](./fulkruma.delivery.updated) &mdash; extend / reset / revoke.
- [`fulkruma.delivery.downloaded.v1`](./fulkruma.delivery.downloaded)

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
