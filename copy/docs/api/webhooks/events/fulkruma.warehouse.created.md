---
title: fulkruma.warehouse.created
---

# `fulkruma.warehouse.created.v1`

Fires when a warehouse is created with `POST /api/v1/warehouses` (or from the dashboard). Subscribe to mirror your warehouse list into another system, seed stock levels, or set up a pickup location with your own carriers.

## When it fires

Inside the same Prisma transaction as the `Warehouse` insert. Exactly once per warehouse id; retries reuse the same `evt_…`. A request that fails validation creates nothing and fires nothing. Changing or archiving a warehouse fires no event.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.warehouse.created.v1",
  "occurredAt": "2026-05-12T10:42:00.123Z",
  "accountId": "acc_01HX...",
  "data": {
    "id": "wh_01HX...",
    "name": "Jakarta DC",
    "address": "Jl. Sudirman 1",
    "city": "Jakarta",
    "postal": "10220",
    "lat": -6.2088,
    "lng": 106.8456,
    "phone": "+6281234567890",
    "isDefault": true,
    "createdAt": "2026-05-12T10:42:00.120Z"
  }
}
```

The fields are the [warehouse object](/docs/api/resources/warehouses)'s, as created: optional ones are `null` when not given. `isDefault` is `true` for an account's first warehouse unless the request said otherwise.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.warehouse.created.v1') {
  const { id, name, city, isDefault } = event.data;
  await erp.locations.upsert({ externalId: id, name, city, primary: isDefault });
}
```

```python
# Python
if event["type"] == "fulkruma.warehouse.created.v1":
    d = event["data"]
    erp.locations.upsert(external_id=d["id"], name=d["name"], city=d["city"], primary=d["isDefault"])
```

```go
// Go
if event.Type == "fulkruma.warehouse.created.v1" {
    var d struct {
        ID, Name  string
        City      *string
        IsDefault bool
    }
    _ = json.Unmarshal(event.Data, &d)
    erp.UpsertLocation(ctx, d.ID, d.Name, d.City, d.IsDefault)
}
```

## What to do

- Mirror the warehouse into your ERP or WMS, keyed by `id`.
- Seed initial stock with `POST /api/v1/stock/adjust` (`reason: "initial_stock"`).

## Common pitfalls

- **Expecting updates.** Renames, address changes and archiving fire nothing; poll [List warehouses](/docs/api/resources/warehouses) and reconcile by `updatedAt` for those.
- **Assuming the old default changed.** Creating a warehouse with `isDefault: true` does not clear the flag on another warehouse.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks) &mdash; signature verification, retries, ordering.
- [**Warehouses resource**](/docs/api/resources/warehouses) &mdash; the object and its API.
