---
title: fulkruma.delivery.created
---

# `fulkruma.delivery.created.v1`

Fires when a delivery grant is issued for a `digital`-type product &mdash; either by a direct `POST /api/v1/deliveries` call or by the Plugipay-checkout webhook on completed checkout for a digital product. Subscribe to email the buyer their download link or kick off any post-purchase fulfilment automation.

## When it fires

Inside the same Prisma transaction as the `Delivery` insert. Exactly one emission per `(productId, checkoutSessionId)` pair &mdash; the `409 DUPLICATE` guard on the create endpoint ensures retries don't double-fire.

The grant is immediately valid: `downloads: 0`, `expiresAt` defaulting to 14 days out, ready to serve.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.delivery.created.v1",
  "occurredAt": "2026-05-12T10:42:00.123Z",
  "accountId": "acc_01HX...",
  "data": {
    "deliveryId": "del_01HXAB7K3M9N2P5QRS8TVWXY3Z",
    "productId": "prod_01HX...",
    "customerId": "cus_01HX...",
    "checkoutSessionId": "cs_01HX..."
  }
}
```

The payload is the minimal join keys. Fetch the full delivery (including `maxDownloads`, `expiresAt`) via `GET /api/v1/deliveries/:id`.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.delivery.created.v1') {
  const { deliveryId, productId, customerId, checkoutSessionId } = event.data;
  const product = await catalog.get(productId);
  await mailer.send(customerId, {
    template: 'digital_delivery',
    productName: product.name,
    downloadUrl: `https://your-app.com/d/${deliveryId}`,
  });
}
```

```python
# Python
if event["type"] == "fulkruma.delivery.created.v1":
    d = event["data"]
    product = catalog.get(d["productId"])
    mailer.send(d["customerId"], template="digital_delivery",
                product_name=product.name, download_url=f"https://your-app.com/d/{d['deliveryId']}")
```

```go
// Go
if event.Type == "fulkruma.delivery.created.v1" {
    var d struct{ DeliveryID, ProductID, CustomerID, CheckoutSessionID string }
    _ = json.Unmarshal(event.Data, &d)
    mailer.SendDigitalDelivery(ctx, d.CustomerID, d.ProductID, d.DeliveryID)
}
```

## What to do

- Email the buyer the download link (Fulkruma doesn't send transactional email itself in v1).
- Provision any per-customer access (cloud bucket pre-signed URL, watermarking, etc.).
- Increment analytics counters for digital sales.

## Common pitfalls

- **Linking directly to the asset.** Build a wrapper endpoint on your side that looks up the delivery, checks expiry / download count, and then signs the asset URL. Don't put a permanent storage URL in the email.
- **Issuing the email twice on retry.** Dedupe on `event.id`. At-least-once delivery means duplicates are expected on transient failures.
- **Forgetting `expiresAt`.** The default 14-day cutoff isn't surfaced in this payload &mdash; fetch the full delivery if you want to put an expiry date in the email.

## Related events

`fulkruma.delivery.downloaded.v1` and `fulkruma.delivery.expired.v1` are reserved in the catalog but **not currently emitted**. Track downloads server-side from the (planned) `/api/v1/deliveries/:id/download` endpoint instead.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Deliveries resource**](/docs/api/resources/deliveries).
- [**Licenses resource**](/docs/api/resources/licenses) &mdash; for license-key fulfilment.
