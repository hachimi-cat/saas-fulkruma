---
title: fulkruma.license.deactivated
---

# `fulkruma.license.deactivated.v1`

Fires when an instance is unbound from a license key (`POST /api/v1/licenses/deactivate`), freeing an activation.

## When it fires

Inside the same transaction as the deactivation &mdash; only when an active instance is unbound; deactivating one that isn't active (`alreadyDeactivated: true`) sends nothing.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.license.deactivated.v1",
  "occurredAt": "2026-05-20T03:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "licenseId": "clx6d5e4f0000aa1b2c3d4e5f",
    "productId": "prod_01HX...",
    "customerId": "cus_01HX...",
    "instanceId": "macbook-7f3a",
    "activations": 0,
    "maxActivations": 2,
    "deactivatedAt": "2026-05-20T03:00:00.000Z"
  },
  "metadata": {}
}
```

`activations` is the license's count after this one.

## Related events

- [`fulkruma.license.activated.v1`](./fulkruma.license.activated)
- [`fulkruma.license.revoked.v1`](./fulkruma.license.revoked)

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Licenses resource**](/docs/api/resources/licenses).
