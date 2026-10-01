---
title: fulkruma.delivery.updated
---

# `fulkruma.delivery.updated.v1`

Fires when a merchant changes a digital-delivery grant from the dashboard or the API: extends its download window, resets its download counter, or revokes it. Subscribe to keep your own copy of the buyer's access in step &mdash; or to tell the buyer.

## When it fires

Inside the same transaction as the change to the delivery. One emission per action.

| `action` | Route | What changed |
|---|---|---|
| `extend` | `POST /api/v1/deliveries/:id/extend` | `expiresAt` moved 30 days out (from now, or from the current expiry if later). |
| `reset-downloads` | `POST /api/v1/deliveries/:id/reset-downloads` | `downloadCount` back to `0`. |
| `revoke` | `POST /api/v1/deliveries/:id/revoke` | `expiresAt` set to now &mdash; the link stops working. |

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.delivery.updated.v1",
  "occurredAt": "2026-05-20T03:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "deliveryId": "clx6d5e4f0000aa1b2c3d4e5f",
    "action": "extend"
  },
  "metadata": {}
}
```

The payload is the id and what was done. Fetch the delivery (`GET /api/v1/deliveries/:id`) for the new `expiresAt` / `downloadCount`.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.delivery.updated.v1') {
  const { deliveryId, action } = event.data;
  const { delivery } = await fulkruma.deliveries.get(deliveryId);
  await access.sync(delivery);
  if (action === 'revoke') await mailer.send('download_revoked', { deliveryId });
}
```

```python
# Python
if event["type"] == "fulkruma.delivery.updated.v1":
    d = event["data"]
    delivery = fulkruma.deliveries.get(d["deliveryId"])["delivery"]
    access.sync(delivery)
```

```go
// Go
if event.Type == "fulkruma.delivery.updated.v1" {
    var d struct{ DeliveryID, Action string }
    _ = json.Unmarshal(event.Data, &d)
    access.Sync(ctx, d.DeliveryID, d.Action)
}
```

## Related events

- [`fulkruma.delivery.created.v1`](./fulkruma.delivery.created) &mdash; the grant being changed.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Deliveries resource**](/docs/api/resources/deliveries).
