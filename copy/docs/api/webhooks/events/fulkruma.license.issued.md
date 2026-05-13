---
title: fulkruma.license.issued
---

# `fulkruma.license.issued.v1`

Fires when a new license key is minted &mdash; either via direct `POST /api/v1/licenses`, the Plugipay-checkout webhook on completed checkout for a `license`-type product, or a Storlaunch-routed order. Subscribe to email the buyer their key or provision dependent entitlements in your own systems.

## When it fires

Inside the same Prisma transaction as the `License` insert. Exactly one emission per license ID; retries reuse the same `evt_…`. The license is immediately `active` with `activations: 0` and ready for the buyer's software to call `/api/v1/licenses/activate`.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.license.issued.v1",
  "occurredAt": "2026-05-12T10:42:00.123Z",
  "accountId": "acc_01HX...",
  "data": {
    "licenseId": "lic_01HXAB7K3M9N2P5QRS8TVWXY3Z",
    "productId": "prod_01HX...",
    "customerId": "cus_01HX..."
  }
}
```

<blockquote class="callout-warn">

**The plaintext key is not in this payload.** Fulkruma deliberately doesn't ship credentials over webhook for the same reason it doesn't ship them over email-without-encryption. Fetch the license via `GET /api/v1/licenses` (filtered by `id`) over a signed request to retrieve the key, then send to the buyer over your own (TLS, authenticated) channel.

</blockquote>

## Handler examples

```js
// Node
if (event.type === 'fulkruma.license.issued.v1') {
  const { licenseId, productId, customerId } = event.data;
  const license = await fk.licenses.list().then((r) =>
    r.licenses.find((l) => l.id === licenseId)
  );
  if (!license) throw new Error('License not found via API after issued event');
  await mailer.send(customerId, {
    template: 'license_key',
    productName: (await catalog.get(productId)).name,
    licenseKey: license.key,
    maxActivations: license.maxActivations,
  });
}
```

```python
# Python
if event["type"] == "fulkruma.license.issued.v1":
    d = event["data"]
    license = next(l for l in fk.licenses.list()["licenses"] if l["id"] == d["licenseId"])
    mailer.send(d["customerId"], template="license_key",
                license_key=license["key"], max_activations=license["maxActivations"])
```

```go
// Go
if event.Type == "fulkruma.license.issued.v1" {
    var d struct{ LicenseID, ProductID, CustomerID string }
    _ = json.Unmarshal(event.Data, &d)
    license := mustFetchLicense(ctx, d.LicenseID)
    mailer.SendLicenseKey(ctx, d.CustomerID, license.Key, license.MaxActivations)
}
```

## What to do

- Fetch the license via the API and email the key to the buyer.
- Provision any out-of-band entitlements (cloud-side allowlists, feature flags).
- Record the issue against your own CRM keyed by `customerId` and `productId`.

## Common pitfalls

- **Expecting `key` in the payload.** It's intentionally absent. Fetch via the API.
- **Sending unencrypted email with sensitive software.** A license key is a credential. Use your usual transactional-email service, not raw SMTP.
- **Skipping the fetch and assuming `maxActivations: 1`.** The default is `1`, but merchants can pass higher; always read the real value before composing the email.

## Related events

- [`fulkruma.license.revoked.v1`](./fulkruma.license.revoked) &mdash; subsequent revocation.

`license.activated` and `license.deactivated` are reserved in the catalog but **not currently emitted** &mdash; activation rates are high-volume and the cost/benefit isn't settled yet.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Licenses resource**](/docs/api/resources/licenses) &mdash; the full object shape and write API.
