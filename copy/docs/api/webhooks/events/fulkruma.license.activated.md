---
title: fulkruma.license.activated
---

# `fulkruma.license.activated.v1`

Fires when a license key is bound to a new instance (a buyer's app calls `POST /api/v1/licenses/activate`).

## When it fires

Inside the same transaction as the activation &mdash; only when an instance is newly bound (or a deactivated one binds again). Calling activate for an instance that is already active (`alreadyActive: true`), or past the cap (`409 MAX_ACTIVATIONS`), sends nothing.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.license.activated.v1",
  "occurredAt": "2026-05-20T03:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "licenseId": "clx6d5e4f0000aa1b2c3d4e5f",
    "productId": "prod_01HX...",
    "customerId": "cus_01HX...",
    "instanceId": "macbook-7f3a",
    "activations": 1,
    "maxActivations": 2,
    "activatedAt": "2026-05-20T03:00:00.000Z"
  },
  "metadata": {}
}
```

`activations` is the license's count after this one.

## Related events

- [`fulkruma.license.deactivated.v1`](./fulkruma.license.deactivated)
- [`fulkruma.license.issued.v1`](./fulkruma.license.issued)

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Licenses resource**](/docs/api/resources/licenses).
