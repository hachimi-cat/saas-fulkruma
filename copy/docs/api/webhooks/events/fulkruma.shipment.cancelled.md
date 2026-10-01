---
title: fulkruma.shipment.cancelled
---

# `fulkruma.shipment.cancelled.v1`

Fires when a shipment is cancelled &mdash; from the dashboard, through `POST /api/v1/shipments/:id/cancel`, or through a partner (Storlaunch) on the merchant's behalf. Fulkruma cancels the courier order (or deletes the draft) and, when the merchant had already paid for it from their prepaid shipping credit, refunds that credit. Subscribe to put the order back to "unshipped" or to start a [rebook](./fulkruma.shipment.rebooked).

## When it fires

After the shipment is marked `cancelled` and any refund applied. Once per shipment: a cancelled shipment cannot be cancelled again. If the courier refused or failed the cancellation, Fulkruma cancels its own record anyway (the parcel is still with the merchant) and reports the courier's message in `courierError`.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.shipment.cancelled.v1",
  "occurredAt": "2026-05-14T08:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "shipmentId": "clx7k2m9p0000qw8e3r5t1y6u",
    "biteshipOrderId": "5dd599ebdefcd4158eb8470b",
    "waybillId": "JO0327373568",
    "reason": "Driver never collected",
    "refunded": 40000,
    "courierError": null,
    "externalSource": "storlaunch",
    "externalRef": "ord_abc"
  },
  "metadata": {}
}
```

| Field | Description |
|---|---|
| `reason` | Why it was cancelled, as given by whoever cancelled it. |
| `refunded` | Shipping credit returned, in rupiah; `0` when nothing had been charged (a draft) or it was already refunded. |
| `courierError` | The courier's error when its side of the cancellation failed; `null` when it went through. |
| `biteshipOrderId`, `waybillId` | `null` for a shipment cancelled before it was booked. |

## Handler examples

```js
// Node
if (event.type === 'fulkruma.shipment.cancelled.v1') {
  const { shipmentId, refunded, courierError } = event.data;
  await orders.markShipmentCancelled(shipmentId);
  if (courierError) await ops.flag('courier cancel failed', { shipmentId, courierError });
}
```

```python
# Python
if event["type"] == "fulkruma.shipment.cancelled.v1":
    d = event["data"]
    orders.mark_shipment_cancelled(d["shipmentId"])
```

```go
// Go
if event.Type == "fulkruma.shipment.cancelled.v1" {
    var d struct {
        ShipmentID   string  `json:"shipmentId"`
        Refunded     int64   `json:"refunded"`
        CourierError *string `json:"courierError"`
    }
    _ = json.Unmarshal(event.Data, &d)
    orders.MarkShipmentCancelled(ctx, d.ShipmentID)
}
```

## Related events

- [`fulkruma.shipment.rebooked.v1`](./fulkruma.shipment.rebooked) &mdash; the replacement shipment, when the merchant books again.
- [`fulkruma.shipment.status_updated.v1`](./fulkruma.shipment.status_updated) &mdash; a cancellation the courier reports itself arrives here with `status: "cancelled"`.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Shipments resource**](/docs/api/resources/shipments).
