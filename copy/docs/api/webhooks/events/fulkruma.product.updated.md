---
title: fulkruma.product.updated
---

# `fulkruma.product.updated.v1`

Fires when a product's fields change through `PATCH /api/v1/products/:id`. Subscribe to keep a copy of your catalog in step.

## When it fires

Inside the same transaction as the update, when at least one field actually changed &mdash; a PATCH that sets fields to their current values sends nothing. `changed` names the fields that did.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.product.updated.v1",
  "occurredAt": "2026-05-20T03:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "productId": "clx6d5e4f0000aa1b2c3d4e5f",
    "name": "Ebook 2e",
    "sku": "EB-1",
    "type": "digital",
    "changed": [
      "name"
    ],
    "updatedAt": "2026-05-20T03:00:00.000Z"
  },
  "metadata": {}
}
```

The payload is the product's identity and what changed; fetch the product (`GET /api/v1/products/:id`) for the full record.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.product.updated.v1') {
  await sync(event.data.productId);
}
```

```python
# Python
if event["type"] == "fulkruma.product.updated.v1":
    sync(event["data"]["productId"])
```

## Related events

- [`fulkruma.product.created.v1`](./fulkruma.product.created)
- [`fulkruma.product.archived.v1`](./fulkruma.product.archived)

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
