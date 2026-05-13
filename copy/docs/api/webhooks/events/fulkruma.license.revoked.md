---
title: fulkruma.license.revoked
---

# `fulkruma.license.revoked.v1`

Fires when a license is revoked &mdash; via `POST /api/v1/licenses/:id/revoke`, either by the merchant in the dashboard or via API. Subscribe to clean up downstream entitlements, notify the buyer, or kick off a refund flow.

## When it fires

Inside the same Prisma transaction as the `License.status` flip to `revoked`. Exactly one emission per revocation; revoking an already-revoked license is a no-op and does **not** emit a duplicate.

After this event:

- The public `/api/v1/licenses/validate` endpoint returns `valid: false` with `status: "revoked"`.
- The public `/api/v1/licenses/activate` endpoint returns `404 INVALID_KEY` for further attempts.
- **Existing active instances are not forcibly cut off** &mdash; they keep working until the next time they call `validate`. Plan for an offline-tolerance grace period in the buyer's software accordingly.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.license.revoked.v1",
  "occurredAt": "2026-05-12T10:42:00.123Z",
  "accountId": "acc_01HX...",
  "data": {
    "licenseId": "lic_01HXAB7K3M9N2P5QRS8TVWXY3Z",
    "productId": "prod_01HX...",
    "customerId": "cus_01HX..."
  }
}
```

## Handler examples

```js
// Node
if (event.type === 'fulkruma.license.revoked.v1') {
  const { licenseId, customerId } = event.data;
  await entitlements.revoke({ customerId, fulkrumaLicenseId: licenseId });
  await mailer.send(customerId, { template: 'license_revoked', licenseId });
}
```

```python
# Python
if event["type"] == "fulkruma.license.revoked.v1":
    d = event["data"]
    entitlements.revoke(customer_id=d["customerId"], fulkruma_license_id=d["licenseId"])
    mailer.send(d["customerId"], template="license_revoked", license_id=d["licenseId"])
```

```go
// Go
if event.Type == "fulkruma.license.revoked.v1" {
    var d struct{ LicenseID, ProductID, CustomerID string }
    _ = json.Unmarshal(event.Data, &d)
    entitlements.Revoke(ctx, d.CustomerID, d.LicenseID)
}
```

## What to do

- Tear down downstream entitlements: cloud allowlists, feature flags, premium-tier flags.
- Optionally email the buyer (refund explanation, chargeback follow-up).
- If the revocation is part of a customer-initiated refund, kick off the refund in Plugipay.

## Common pitfalls

- **Expecting the buyer's software to stop immediately.** It doesn't &mdash; it stops on the next `validate` poll. Don't promise instant lockout in support tickets.
- **Forgetting about active activations.** The license's `activations` counter doesn't reset on revoke. If you reissue (mint a new license to the same customer), it's a separate row with a fresh counter.
- **Triggering on every revoke regardless of reason.** A revoke after a chargeback is different from a revoke during product retirement &mdash; capture context in your own systems before the revoke call, since the event payload doesn't carry a reason.

## Related events

- [`fulkruma.license.issued.v1`](./fulkruma.license.issued) &mdash; the original mint.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Licenses resource**](/docs/api/resources/licenses) &mdash; the full lifecycle and the public activate/deactivate/validate endpoints.
