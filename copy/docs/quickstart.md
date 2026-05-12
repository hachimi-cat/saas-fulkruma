---
title: Quickstart
---

# Quickstart

You'll have a working fulfilment flow in about five minutes. By the end of this page you'll have:

1. Signed up for a Fulkruma workspace.
2. Added a warehouse and a product.
3. Generated an API key.
4. Created a test shipment.

If you'd rather read about concepts first, jump to [**Concepts**](/docs/concepts). If you'd rather install the CLI or SDK first, see [**Installation**](/docs/installation).

## Prerequisites

You'll need:

- A working email address &mdash; we use Huudis SSO for sign-in, and verifying an email is part of sign-up.
- About five minutes.
- Either a terminal with `curl` (to follow this page's examples literally) or an SDK installed (covered in [Installation](/docs/installation)).

You do **not** need to connect Biteship or a real courier for this Quickstart. We'll record a placeholder shipment locally without round-tripping to a courier.

## 1. Sign up

Head to [**fulkruma.com**](https://fulkruma.com) and click **Get started**. We use Huudis as our identity provider &mdash; you'll create one Huudis account and use it across every Forjio product (Fulkruma, Plugipay, Storlaunch, LinkSnap, and the rest).

Sign-up takes two clicks:

1. Enter your email and choose a password.
2. Click the verification link we send you.

Once you're verified, you land in your first workspace's dashboard.

<blockquote class="callout-note">

**Workspaces** are how Fulkruma isolates data. You get one workspace by default, scoped to your Huudis identity. Each workspace has its own warehouses, products, stock, shipments, and API keys.

</blockquote>

## 2. Add a warehouse

In the dashboard, navigate to **Warehouses** (or go directly to `/dashboard/warehouses`).

Click **Add warehouse**. Give it a name (something like "Main warehouse"), an address, and a city. The first warehouse you create is automatically marked as the default &mdash; it's where stock lands by default and where shipments dispatch from.

You can add more later for multi-location fulfilment.

## 3. Add a product and stock

Go to **Products** &rarr; **Add product**. Give it a name, an SKU, and a weight (used for shipping rates). For physical goods, leave **Type** as `physical`. For software, pick `digital` or `license`.

Once the product is created, go to **Stock** &rarr; **Adjust stock**. Pick the variant and warehouse, set a delta (e.g. `+100`), and a reason (`initial`). Save.

You now have 100 units of stock in your warehouse, recorded in the stock ledger.

## 4. Get an API key

In the dashboard, navigate to **Settings &rarr; API keys** (or go directly to `/dashboard/settings`).

Click **Create API key**. Give it a description (something like "Quickstart").

Fulkruma shows the secret key **once**. Copy it into your terminal as environment variables:

```bash
export FULKRUMA_KEY_ID=AKIAFULK...
export FULKRUMA_KEY_SECRET=...
```

<blockquote class="callout-warn">

**Treat the secret like a password.** Anyone with `FULKRUMA_KEY_SECRET` can move stock and create shipments on the workspace. We never display it again after creation. If you lose it, revoke the key and mint a new one.

</blockquote>

## 5. Create a test shipment

The simplest end-to-end flow is a **shipment** &mdash; Fulkruma records the intent to ship items from one of your warehouses to a customer address.

Create one with `curl`:

```bash
curl -X POST https://fulkruma.com/api/v1/shipments \
  -H "Content-Type: application/json" \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=$FULKRUMA_KEY_ID, scope=*, signature=<see below>" \
  -H "X-Fulkruma-Timestamp: $(date +%s)" \
  -d '{
    "courierCode": "jne",
    "courierServiceCode": "reg",
    "courierType": "standard",
    "price": 15000,
    "origin": { "warehouseId": "<your-warehouse-id>" },
    "destination": { "name": "Test Buyer", "address": "Jl. Test 123, Jakarta" },
    "items": [{ "name": "Test product", "quantity": 1, "weight": 500 }]
  }'
```

Fulkruma uses **HMAC signing** &mdash; you compute a SHA-256 HMAC of `timestamp + method + path + body_hash` with your secret key. The exact algorithm is documented in [**API Authentication**](/docs/api/authentication). The SDKs and CLI handle this for you automatically.

### Easier: use the SDK

If you've installed an SDK, the same call becomes:

**Node.js:**

```js
import { FulkrumaClient } from '@forjio/fulkruma-node';

const fulkruma = new FulkrumaClient({
  keyId: process.env.FULKRUMA_KEY_ID,
  secret: process.env.FULKRUMA_KEY_SECRET,
});

const { shipment } = await fulkruma.shipments.create({
  courierCode: 'jne',
  courierServiceCode: 'reg',
  courierType: 'standard',
  price: 15000,
  origin: { warehouseId: '<your-warehouse-id>' },
  destination: { name: 'Test Buyer', address: 'Jl. Test 123, Jakarta' },
  items: [{ name: 'Test product', quantity: 1, weight: 500 }],
});

console.log('Shipment:', shipment.id);
```

**Python:**

```python
from fulkruma import FulkrumaClient
import os

fulkruma = FulkrumaClient(
    key_id=os.environ["FULKRUMA_KEY_ID"],
    secret=os.environ["FULKRUMA_KEY_SECRET"],
)

shipment = fulkruma.shipments.create(
    courier_code="jne",
    courier_service_code="reg",
    courier_type="standard",
    price=15000,
    origin={"warehouseId": "<your-warehouse-id>"},
    destination={"name": "Test Buyer", "address": "Jl. Test 123, Jakarta"},
    items=[{"name": "Test product", "quantity": 1, "weight": 500}],
)

print("Shipment:", shipment["id"])
```

**Go:**

```go
import fulkruma "github.com/hachimi-cat/saas-fulkruma/sdk/go"

client, _ := fulkruma.NewClient(fulkruma.ClientOptions{
    KeyID:  os.Getenv("FULKRUMA_KEY_ID"),
    Secret: os.Getenv("FULKRUMA_KEY_SECRET"),
})

shipment, _ := client.Shipments.Create(ctx, fulkruma.ShipmentInput{
    CourierCode:        "jne",
    CourierServiceCode: "reg",
    CourierType:        "standard",
    Price:              15000,
    Origin:             map[string]any{"warehouseId": "<your-warehouse-id>"},
    Destination:        map[string]any{"name": "Test Buyer"},
    Items:              []map[string]any{{"name": "Test product", "quantity": 1, "weight": 500}},
})

fmt.Println("Shipment:", shipment.ID)
```

## 6. Verify it worked

Check the dashboard at **Shipments**. You should see your shipment listed with a status of `pending`.

Or fetch it via API:

```bash
curl https://fulkruma.com/api/v1/shipments \
  -H "Authorization: Fulkruma-HMAC-SHA256 keyId=$FULKRUMA_KEY_ID, scope=*, signature=..." \
  -H "X-Fulkruma-Timestamp: $(date +%s)"
```

You did it &mdash; you've recorded your first Fulkruma shipment.

<blockquote class="callout-note">

**About the courier integration.** This Quickstart records a shipment in Fulkruma's database without round-tripping to a real courier (Biteship). When you wire up your Biteship API key under **Settings &rarr; Integrations**, the same `shipments.create` call books the order with the courier and stores the real tracking ID. The Fulkruma API surface doesn't change either way.

</blockquote>

## What's next

- [**Installation**](/docs/installation) &mdash; install the SDK or CLI properly for your project.
- [**Concepts**](/docs/concepts) &mdash; understand the model behind warehouses, products, stock, and shipments before going further.
- [**Portal &rarr; Shipments**](/docs/portal/shipments) &mdash; the full lifecycle with status updates and tracking.
- [**API reference**](/docs/api) &mdash; every endpoint, every parameter.
