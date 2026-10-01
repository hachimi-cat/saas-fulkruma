---
title: fulkruma.shipment.pickup_confirmed
---

# `fulkruma.shipment.pickup_confirmed.v1`

Fires when a shipment's draft is confirmed with the courier &mdash; the merchant pressed **Book courier** in the dashboard, or called `POST /api/v1/shipments/:id/confirm-pickup`. Biteship has created the real order and is dispatching a driver; the shipment now has a courier order id and, usually, a waybill number. Subscribe to show the buyer their tracking number or to mark the order "awaiting pickup".

## When it fires

Inside the same transaction that stores the courier order on the shipment, moves it to `confirmed` and (when the shipment has a price) debits the merchant's prepaid shipping credit. Exactly one emission per shipment: confirming an already-booked shipment is refused with `409 ALREADY_CONFIRMED`.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.shipment.pickup_confirmed.v1",
  "occurredAt": "2026-05-12T11:05:00.123Z",
  "accountId": "acc_01HX...",
  "data": {
    "shipmentId": "clx7k2m9p0000qw8e3r5t1y6u",
    "biteshipOrderId": "5dd599ebdefcd4158eb8470b",
    "waybillId": "JO0327373568"
  },
  "metadata": {}
}
```

| Field | Description |
|---|---|
| `shipmentId` | The Fulkruma shipment. |
| `biteshipOrderId` | The courier aggregator's order id. |
| `waybillId` | The courier's tracking number, or `null` when the courier allocates it later &mdash; it then arrives on a [`status_updated`](./fulkruma.shipment.status_updated) event. |

## Handler examples

```js
// Node
if (event.type === 'fulkruma.shipment.pickup_confirmed.v1') {
  const { shipmentId, waybillId } = event.data;
  await orders.markAwaitingPickup({ fulkrumaShipmentId: shipmentId, waybillId });
}
```

```python
# Python
if event["type"] == "fulkruma.shipment.pickup_confirmed.v1":
    d = event["data"]
    orders.mark_awaiting_pickup(fulkruma_shipment_id=d["shipmentId"], waybill_id=d.get("waybillId"))
```

```go
// Go
if event.Type == "fulkruma.shipment.pickup_confirmed.v1" {
    var d struct {
        ShipmentID      string  `json:"shipmentId"`
        BiteshipOrderID string  `json:"biteshipOrderId"`
        WaybillID       *string `json:"waybillId"`
    }
    _ = json.Unmarshal(event.Data, &d)
    orders.MarkAwaitingPickup(ctx, d.ShipmentID, d.WaybillID)
}
```

## Common pitfalls

- **Assuming a waybill.** `waybillId` can be `null` here; take it from the next status update when it is.
- **Treating it as picked up.** The driver is on the way, not there. `picked_up` arrives as a status update.

## Related events

- [`fulkruma.shipment.created.v1`](./fulkruma.shipment.created) &mdash; the draft this confirms.
- [`fulkruma.shipment.status_updated.v1`](./fulkruma.shipment.status_updated) &mdash; everything the courier reports afterwards.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks) &mdash; signature verification, retries, the delivery log.
- [**Shipments resource**](/docs/api/resources/shipments).
