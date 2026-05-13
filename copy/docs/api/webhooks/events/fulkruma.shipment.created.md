---
title: fulkruma.shipment.created
---

# `fulkruma.shipment.created.v1`

Fires when a new shipment is created in Fulkruma &mdash; either by a direct `POST /api/v1/shipments` call, by the Plugipay-checkout webhook for an order containing physical items, or by a Storlaunch product order routed through Pattern 2. This is the canonical "we have a parcel to track now" signal: subscribe to mirror shipment rows into your own fulfilment dashboard or notify the buyer their order is being prepared.

## When it fires

Inside the same Prisma transaction as the `Shipment` insert &mdash; you'll see the event before any subsequent status transition. There is exactly one emission per shipment ID; retries reuse the same `evt_…`.

The shipment's initial status is `pending` while we wait for the Biteship adapter (Phase F) to send the order upstream, or `confirmed` once the courier acknowledges. The event fires at insert time regardless of which status path the shipment then walks.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.shipment.created.v1",
  "occurredAt": "2026-05-12T10:42:00.123Z",
  "accountId": "acc_01HX...",
  "data": {
    "shipmentId": "ship_01HXAB7K3M9N2P5QRS8TVWXY3Z",
    "checkoutSessionId": "cs_01HX...",
    "courierCode": "jne",
    "status": "pending"
  }
}
```

The `data` field is the minimal shipment summary &mdash; just the IDs and the courier code. Fetch the full shipment via `GET /api/v1/shipping/shipments/:id` if you need the destination, items, or label.

## Handler examples

```js
// Node
import { verifyWebhook } from '@forjio/fulkruma/webhooks';

app.post('/webhooks/fulkruma', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = verifyWebhook(req.body, req.headers['fulkruma-signature'], process.env.FULKRUMA_WEBHOOK_SECRET);
  if (event.type === 'fulkruma.shipment.created.v1') {
    const { shipmentId, checkoutSessionId, courierCode } = event.data;
    await orders.markShipping(checkoutSessionId, { fulkrumaShipmentId: shipmentId, courier: courierCode });
  }
  res.status(200).end();
});
```

```python
# Python
if event["type"] == "fulkruma.shipment.created.v1":
    d = event["data"]
    orders.mark_shipping(d["checkoutSessionId"], fulkruma_shipment_id=d["shipmentId"], courier=d["courierCode"])
```

```go
// Go
if event.Type == "fulkruma.shipment.created.v1" {
    var d struct{ ShipmentID, CheckoutSessionID, CourierCode, Status string }
    _ = json.Unmarshal(event.Data, &d)
    orders.MarkShipping(ctx, d.CheckoutSessionID, d.ShipmentID, d.CourierCode)
}
```

## What to do

- Mark the order "shipping" in your own DB; surface the Fulkruma shipment ID to support agents.
- Email the buyer that the parcel is in motion (use the in-shipment customer email or pull from your CRM).
- Schedule a follow-up to fetch the label and waybill once they're available (see `/shipping/shipments/:id/label`).
- Increment a "shipments in flight" analytics counter.

## Common pitfalls

- **Treating the event as `confirmed`.** Phase E records the shipment with a placeholder `biteshipOrderId` (prefixed `pending-`). The courier hasn't accepted yet. Watch for the status transition rather than assuming the event means dispatched.
- **Charging shipping fees here.** Shipping price was set on the originating Plugipay checkout. Re-charging here would double-bill.
- **Skipping signature verification.** Always verify the `Fulkruma-Signature` header before trusting the payload.

## Related events

- [`fulkruma.product.created.v1`](./fulkruma.product.created) &mdash; the product whose stock the shipment will consume.
- [`fulkruma.stock.adjusted.v1`](./fulkruma.stock.adjusted) &mdash; the movement that fires when the shipment ships.

`fulkruma.shipment.delivered.v1`, `fulkruma.shipment.cancelled.v1`, and `fulkruma.shipment.returned.v1` are reserved in the catalog but **not currently emitted**. Subscribe defensively if you want to handle them when they ship.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks) &mdash; signature verification, retries, ordering.
- [**Shipments resource**](/docs/api/resources/shipments) &mdash; the full object shape and write API.
