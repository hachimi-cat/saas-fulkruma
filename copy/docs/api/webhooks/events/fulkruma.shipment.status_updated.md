---
title: fulkruma.shipment.status_updated
---

# `fulkruma.shipment.status_updated.v1`

Fires every time the courier reports a new status for a booked shipment &mdash; allocated, picking up, picked up, in transit, delivered, returned, and so on. Biteship pushes these to Fulkruma as the parcel moves; Fulkruma records them on the shipment's timeline and passes each one on. This is the event to watch for **delivered**: there is no separate delivered event.

## When it fires

After Fulkruma has appended the status to the shipment's event history and updated the shipment's `status` (and its `waybillId`, when the courier sends one). One emission per status report the courier sends, so the same `status` can arrive more than once if the courier repeats itself.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.shipment.status_updated.v1",
  "occurredAt": "2026-05-13T09:12:44.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "shipmentId": "clx7k2m9p0000qw8e3r5t1y6u",
    "biteshipOrderId": "5dd599ebdefcd4158eb8470b",
    "biteshipTrackingId": "6051861741a37414e6637fab",
    "waybillId": "JO0327373568",
    "status": "delivered",
    "note": "Parcel received by RANI",
    "occurredAt": "2026-05-13T09:12:40.000Z",
    "externalSource": "storlaunch",
    "externalRef": "ord_abc"
  },
  "metadata": {}
}
```

| Field | Description |
|---|---|
| `status` | Fulkruma's shipment status: `allocated`, `picking_up`, `picked_up`, `dropping_off`, `on_hold`, `return_in_transit`, `delivered`, `rejected`, `rejected_by_recipient`, `returned`, `cancelled`, `courier_not_found`, `disposed`, `failed` (and `confirmed` / `scheduled`). |
| `note` | The courier's own description, when it sent one. |
| `data.occurredAt` | When the courier says it happened (the envelope's `occurredAt` is when Fulkruma recorded it). |
| `waybillId` | The tracking number &mdash; may first appear here rather than on `pickup_confirmed`. |
| `externalSource`, `externalRef` | What the shipment was created with (e.g. the partner and its order id), so you can find your own order without a lookup. |

## Handler examples

```js
// Node
if (event.type === 'fulkruma.shipment.status_updated.v1') {
  const { shipmentId, status, occurredAt } = event.data;
  // Deliveries are concurrent and retried: ignore a report older than the last one applied.
  await orders.applyShipmentStatus(shipmentId, status, new Date(occurredAt));
  if (status === 'delivered') await mailer.send('order_delivered', { shipmentId });
}
```

```python
# Python
if event["type"] == "fulkruma.shipment.status_updated.v1":
    d = event["data"]
    orders.apply_shipment_status(d["shipmentId"], d["status"], d["occurredAt"])
```

```go
// Go
if event.Type == "fulkruma.shipment.status_updated.v1" {
    var d struct {
        ShipmentID string `json:"shipmentId"`
        Status     string `json:"status"`
        OccurredAt string `json:"occurredAt"`
    }
    _ = json.Unmarshal(event.Data, &d)
    orders.ApplyShipmentStatus(ctx, d.ShipmentID, d.Status, d.OccurredAt)
}
```

## Common pitfalls

- **Applying statuses in arrival order.** Deliveries run concurrently and a retried one arrives late. Compare `data.occurredAt` with the last status you applied and drop older ones.
- **Expecting each status once.** Couriers repeat themselves; make the handler idempotent per `(shipmentId, status)` as well as per event `id`.

## Related events

- [`fulkruma.shipment.pickup_confirmed.v1`](./fulkruma.shipment.pickup_confirmed) &mdash; the booking that starts these.
- [`fulkruma.shipment.cancelled.v1`](./fulkruma.shipment.cancelled) &mdash; a cancellation from the merchant's side.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Shipments resource**](/docs/api/resources/shipments) &mdash; the full shipment and its tracking history.
