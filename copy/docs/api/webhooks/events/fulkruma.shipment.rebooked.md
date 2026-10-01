---
title: fulkruma.shipment.rebooked
---

# `fulkruma.shipment.rebooked.v1`

Fires when a dead shipment (cancelled, rejected, courier not found, failed Fires when a dead shipment (cancelled, or failed at the courier) is rebookedmdash; or a draft that never reached the courier) is rebooked &mdash; `POST /api/v1/shipments/:id/rebook`, or **Rebook** in the dashboard. Courier orders can't be revived, so Fulkruma creates a **new** shipment from the old one's origin, destination and items (optionally with another courier) and links the two. Subscribe to point your order at the new shipment.

## When it fires

After the new shipment and its courier draft are created. Once per dead shipment: a shipment can be rebooked only once. Like any new shipment, the replacement still has to be [confirmed](./fulkruma.shipment.pickup_confirmed) before a driver comes.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.shipment.rebooked.v1",
  "occurredAt": "2026-05-14T08:05:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "shipmentId": "clx8a1b2c0000zz9y8x7w6v5u",
    "previousShipmentId": "clx7k2m9p0000qw8e3r5t1y6u",
    "courierCode": "sicepat",
    "courierServiceCode": "reg",
    "price": 18000,
    "biteshipDraftOrderId": "6612f0c1a1b2c3d4e5f60718",
    "draftCreateError": null,
    "externalSource": "storlaunch",
    "externalRef": "ord_abc"
  },
  "metadata": {}
}
```

| Field | Description |
|---|---|
| `shipmentId` | The **new** shipment. |
| `previousShipmentId` | The dead one it replaces. |
| `courierCode`, `courierServiceCode`, `price` | What the new shipment is booked with. |
| `biteshipDraftOrderId`, `draftCreateError` | The new courier draft, or why creating it failed (the shipment exists either way; confirm it again once fixed). |

## Handler examples

```js
// Node
if (event.type === 'fulkruma.shipment.rebooked.v1') {
  const { shipmentId, previousShipmentId } = event.data;
  await orders.replaceShipment(previousShipmentId, shipmentId);
}
```

```python
# Python
if event["type"] == "fulkruma.shipment.rebooked.v1":
    d = event["data"]
    orders.replace_shipment(d["previousShipmentId"], d["shipmentId"])
```

```go
// Go
if event.Type == "fulkruma.shipment.rebooked.v1" {
    var d struct {
        ShipmentID         string `json:"shipmentId"`
        PreviousShipmentID string `json:"previousShipmentId"`
    }
    _ = json.Unmarshal(event.Data, &d)
    orders.ReplaceShipment(ctx, d.PreviousShipmentID, d.ShipmentID)
}
```

## Related events

- [`fulkruma.shipment.cancelled.v1`](./fulkruma.shipment.cancelled) &mdash; usually what came before.
- [`fulkruma.shipment.pickup_confirmed.v1`](./fulkruma.shipment.pickup_confirmed) &mdash; when the new shipment is booked.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Shipments resource**](/docs/api/resources/shipments).
