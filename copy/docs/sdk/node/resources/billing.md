---
title: Billing
---

# Billing

The `billing` namespace is the **merchant's subscription to Fulkruma itself** &mdash; not the merchant's billing of their own end customers. Read plans, the current subscription, usage, and invoices; redirect to a hosted checkout to upgrade; cancel. Under the hood this is all powered by Plugipay (using the Pattern 2 partner-billing flow), but the SDK exposes a flat surface. For HTTP fields, see [API: Billing](/docs/api/resources/billing).

## Namespace

`fulkruma.billing` &mdash; every method:

```ts
fulkruma.billing.plans()
fulkruma.billing.currentPlan()
fulkruma.billing.subscription()
fulkruma.billing.usage()
fulkruma.billing.invoices(params?)
fulkruma.billing.checkout(input)
fulkruma.billing.cancel()
```

Seven methods. Six reads + cancel + a checkout-redirect builder. There's no "upgrade in place" &mdash; every plan change goes through `checkout`, which returns a hosted URL on `pay.plugipay.com`.

## Methods

### `billing.plans`

**Signature.** `fulkruma.billing.plans(): Promise<Array<Record<string, unknown>>>`

Returns every plan Fulkruma offers. Each plan has an `id`, name, price, and feature/limit map. Cache the response for the page lifetime; plans change rarely.

```ts
const plans = await fulkruma.billing.plans();
for (const p of plans as Array<{ id: string; name: string; priceCents: number }>) {
  console.log(`${p.name} — Rp${p.priceCents / 100}`);
}
```

### `billing.currentPlan`

**Signature.** `fulkruma.billing.currentPlan(): Promise<Record<string, unknown>>`

The merchant's current plan. Identical shape to one entry in `plans()`, plus a `currentPeriodEnd` timestamp.

```ts
const current = await fulkruma.billing.currentPlan();
console.log(current);
```

### `billing.subscription`

**Signature.** `fulkruma.billing.subscription(): Promise<Record<string, unknown>>`

The full subscription object &mdash; status, period, cancel-at-end flag, Plugipay subscription ID, the merchant-side payment method ID. Use this for "what's my state?" checks.

```ts
const sub = await fulkruma.billing.subscription();
const s = sub as { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string };
if (s.status === 'past_due') notifyMerchant();
```

### `billing.usage`

**Signature.** `fulkruma.billing.usage(): Promise<Record<string, unknown>>`

Current period's metered usage &mdash; shipment count, stock movement count, license issuance count &mdash; against the plan's caps. The frontend `/billing` page in the portal renders this.

```ts
const usage = await fulkruma.billing.usage();
console.log(usage);  // { shipments: { used: 412, limit: 1000 }, ... }
```

### `billing.invoices`

**Signature.** `fulkruma.billing.invoices(params?): Promise<{ invoices: Array<Record<string, unknown>>; nextCursor?: string }>`

Cursor-paginated invoice list. `limit` defaults to 25, max 100. `cursor` is opaque from a previous response.

```ts
let cursor: string | undefined;
do {
  const { invoices, nextCursor } = await fulkruma.billing.invoices({ limit: 50, cursor });
  for (const inv of invoices) {
    console.log(inv);
  }
  cursor = nextCursor;
} while (cursor);
```

### `billing.checkout`

**Signature.** `fulkruma.billing.checkout(input): Promise<{ url: string; sessionId: string }>`

Creates a Plugipay-hosted checkout session for upgrading/changing plans. Pass the target `planId` (from `plans()`) and optional success/cancel URLs to return the buyer to your portal.

```ts
const { url } = await fulkruma.billing.checkout({
  planId: 'plan_growth',
  successUrl: 'https://your-portal.example.com/billing?ok=1',
  cancelUrl: 'https://your-portal.example.com/billing?cancelled=1',
});
// Redirect the merchant's browser to `url`
```

The hosted URL handles card capture + 3DS + the partner-billing routing back to Fulkruma. On success, Plugipay calls our internal webhook which updates the subscription; the merchant lands on `successUrl`.

### `billing.cancel`

**Signature.** `fulkruma.billing.cancel(): Promise<Record<string, unknown>>`

Cancels the subscription **at period end** &mdash; the merchant keeps access until the current period closes, then drops to the free plan (or fully off, depending on workspace config).

```ts
await fulkruma.billing.cancel();
```

This call is idempotent &mdash; calling it again on an already-cancelling subscription is a no-op. To un-cancel, run `checkout` against the same plan again.

## Types

The billing namespace returns intentionally-loose shapes (`Record<string, unknown>`) because the per-plan feature map and per-invoice line-item shape evolve faster than the SDK release cycle. For stable fields you can rely on:

- `plans[].id`, `plans[].name`, `plans[].priceCents`
- `subscription.status` &mdash; `'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete'`
- `subscription.currentPeriodEnd` &mdash; ISO-8601
- `invoices[].id`, `invoices[].amountCents`, `invoices[].paidAt`
- `checkout.url` &mdash; the Plugipay-hosted URL to redirect to

See [API: Billing](/docs/api/resources/billing) for the per-version field map.

## Common patterns

### Render a billing dashboard

```ts
async function billingDashboard() {
  const [sub, usage, plans] = await Promise.all([
    fulkruma.billing.subscription(),
    fulkruma.billing.usage(),
    fulkruma.billing.plans(),
  ]);
  return { sub, usage, plans };
}
```

Parallelize the three reads &mdash; they have no dependencies.

### Upgrade flow

```ts
async function upgradeTo(planId: string) {
  const { url } = await fulkruma.billing.checkout({
    planId,
    successUrl: `${process.env.PORTAL_URL}/billing?upgrade=success`,
    cancelUrl: `${process.env.PORTAL_URL}/billing?upgrade=cancelled`,
  });
  return url;  // your route handler returns a 302 to this
}
```

### Listen for plan changes

Don't poll `billing.subscription()`; subscribe to `fulkruma.subscription.updated`:

```ts
fulkruma.webhooks.createEndpoint({
  url: 'https://your-portal.example.com/webhooks/fulkruma',
  events: ['fulkruma.subscription.updated'],
});
```

The event payload mirrors the `subscription()` response.

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Unknown `planId`, bad URL format on checkout. |
| `not_found` | 404 | Plan ID doesn't exist; merchant has no subscription yet. |
| `conflict` | 409 | Checkout on a plan the merchant already has; cancel on an already-cancelled sub. |
| `forbidden` | 403 | Key lacks `fulkruma:billing:read` / `:write`. |
| `plugipay_error` | 502 | Upstream Plugipay returned an error. |

`plugipay_error` is the retry candidate &mdash; transient blips in the partner-billing path.

## Next

- [Integrations](/docs/sdk/node/resources/integrations) &mdash; check the Plugipay link status if billing isn't working.
- [API: Billing](/docs/api/resources/billing) &mdash; HTTP reference.
- [Webhooks](/docs/sdk/node/resources/webhooks) &mdash; subscribe to `subscription.updated`.
