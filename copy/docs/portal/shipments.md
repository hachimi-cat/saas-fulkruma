---
title: Shipments
---

# Shipments

![Plugipay family portal: shipments](/docs-img/portal/shipments.png)


A **shipment** is a real-world delivery from one of your warehouses to a customer address. A **delivery** is the digital equivalent &mdash; a download URL or a license key. This page covers both, since the dashboard surfaces them side by side.

## Lifecycle

A shipment goes through these states:

| State | Means | Next |
|---|---|---|
| `pending` | Created locally, not yet sent to a courier | `confirmed` or `failed` |
| `confirmed` | Booked with a courier; pickup awaited | `picked_up` |
| `picked_up` | Courier has collected the package | `in_transit` |
| `in_transit` | On its way to the destination | `delivered` or `failed` |
| `delivered` | Customer signed for / received it | (terminal) |
| `failed` | Courier was unable to deliver | `returned` |
| `returned` | Package came back to the origin | (terminal) |

Most state transitions come from the courier (Biteship's webhook). You can manually update status from the dashboard for offline corrections.

## Creating a shipment

Navigate to **Dashboard &rarr; Shipments** and click **New shipment**. Fill in:

| Section | Fields |
|---|---|
| Origin | The warehouse the shipment ships from. Defaults to your default warehouse. |
| Destination | Customer address (existing address book entry or new one). |
| Items | One or more line items: product, variant, quantity, weight. |
| Courier | Pick from the available couriers and services. |
| Pricing | Price you paid for the label; optional insurance. |

Click **Create**.

If Biteship is configured under **Settings &rarr; Integrations**, Fulkruma books the order with Biteship and stores the courier's tracking ID. If not, the shipment is recorded locally with a placeholder ID for development.

## Shipping rates

Before creating a shipment, you'll usually want to know what couriers and prices are available for a given route. Go to **Shipping &rarr; Rates** (or call `POST /api/v1/shipping/rates`):

```bash
curl -X POST https://fulkruma.com/api/v1/shipping/rates \
  -H "Authorization: ..." \
  -d '{
    "destination": {"city": "Jakarta", "postal": "12345"},
    "items": [{"weight": 500, "quantity": 1}],
    "insurance": false
  }'
```

The response is a list of `(courier, service, price, eta)` tuples sourced from Biteship. Pick one and pass `courierCode` + `courierServiceCode` to `shipments.create`.

You can also set a default origin under **Shipping &rarr; Origin** so you don't have to specify it on every rate request.

## Shipment events

Every status change records a **shipment event**. The detail page shows the event timeline:

```
2026-05-12 10:42  Created     (you)
2026-05-12 10:43  Confirmed   (Biteship: order #BTS-12345)
2026-05-12 14:10  Picked up   (Biteship: courier #JNE-789)
2026-05-13 09:01  In transit  (Biteship: out for delivery)
2026-05-13 13:24  Delivered   (Biteship: signed by recipient)
```

Each event has:

- An `occurredAt` (when the real-world event happened, per the courier)
- A `recordedAt` (when Fulkruma received the update)

Both are useful: `occurredAt` for accurate timelines; `recordedAt` for debugging webhook delivery delays.

## Webhooks for shipment status

Wire `shipment.created`, `shipment.status_changed`, `shipment.delivered`, and `shipment.failed` webhooks to your application so you can notify customers, update your CRM, or trigger downstream flows.

The full event catalog is on the **Webhooks** page in the dashboard.

## Deliveries (digital fulfilment)

For `digital` and `license` products, you use **deliveries** instead of shipments. Navigate to **Dashboard &rarr; Deliveries**.

A delivery has:

- A reference to a `digital` or `license` product
- A customer
- Optional `maxDownloads` (for digital files)
- Optional `expiresAt`

Create one via **New delivery** or by calling `POST /api/v1/deliveries`. Fulkruma:

- For `digital` products: generates a short-lived signed download URL that the customer can use.
- For `license` products: issues a license key and links it to the delivery.

The customer can be emailed the link/key by the consuming product (Storlaunch, your custom storefront) &mdash; Fulkruma owns the issuance, not the notification.

## Licenses

License keys produced by deliveries are managed under **Dashboard &rarr; Licenses**. Each row shows the key, its product, the customer, max activations, current activations, and status.

From the detail page you can:

- **View activations** &mdash; which instances/machines have this license bound.
- **Revoke** &mdash; deactivate the license. Customers lose access on their next `licenses.validate` ping.
- **Extend** &mdash; bump the expiration date.

The three public license endpoints (`activate`, `deactivate`, `validate`) authenticate by the license key itself &mdash; not your API key &mdash; so customer-facing software can call them without secrets. See [**Concepts &rarr; License**](/docs/concepts) for details.

## Common workflows

### Order &rarr; ship

1. Customer pays via Storlaunch (or your storefront).
2. Storlaunch (or your code) calls `POST /api/v1/shipments` with the order details.
3. Fulkruma books Biteship and returns the shipment.
4. You get `shipment.created`, then `shipment.status_changed`, then `shipment.delivered` webhooks.
5. Show the tracking link to the customer.

### Return

1. Customer requests a return.
2. You create a new shipment with origin = customer address, destination = your warehouse.
3. When `shipment.delivered` fires, run a `stock.adjust` of reason `return` to add the unit back to inventory.

### License sale

1. Customer buys a license product.
2. Your code calls `POST /api/v1/deliveries` with the product and customer.
3. Fulkruma issues a license; the response includes the key.
4. You email the key to the customer.
5. The customer's software calls `POST /api/v1/licenses/activate` on first launch and `GET /api/v1/licenses/validate` on every subsequent launch.

## Next

- [**Concepts**](/docs/concepts) &mdash; the data model behind shipments, deliveries, and licenses.
- [**API reference**](/docs/api) &mdash; the full HTTP surface.
- [**Warehouses**](/docs/portal/warehouses) &mdash; configure where shipments originate from.
