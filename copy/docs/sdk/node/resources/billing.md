---
title: Billing
---

# Billing

The `billing` namespace is the **merchant's subscription to Fulkruma itself** &mdash; not the merchant's billing of their own end customers. Read plans, the current plan and subscription, usage, and invoices; start a hosted checkout to upgrade; cancel. Under the hood this is all powered by Plugipay (the Pattern 2 partner-billing flow), but the SDK exposes a flat surface. For HTTP fields, see [API: Billing](/docs/api/resources/billing).

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

Five reads, a checkout and a cancel. There's no "upgrade in place" &mdash; every plan change goes through `checkout`, which returns a hosted Plugipay URL.

## Methods

### `billing.plans`

**Signature.** `fulkruma.billing.plans(): Promise<Array<Record<string, unknown>>>`

Every plan Fulkruma offers: `free`, `starter`, `growth`, `scale`. Each has an `id`, `name`, `price` (in IDR), `currency` (`'IDR'`) and `features` (display strings). No credentials needed.

```ts
const plans = await fulkruma.billing.plans();
for (const p of plans as Array<{ id: string; name: string; price: number }>) {
  console.log(`${p.name} — Rp${p.price.toLocaleString('id-ID')}/month`);
}
```

### `billing.currentPlan`

**Signature.** `fulkruma.billing.currentPlan(): Promise<Record<string, unknown>>`

The workspace's plan and its limits: `plan`, `planName`, `ordersLimit`, `warehousesLimit`, `licenseKeysLimit`, `apiKeysLimit`, `webhookEndpointsLimit`, `rateLimit`, `biteshipShipmentsLimit` (each `-1` for unlimited) and `billingCycleEnd`.

```ts
const current = await fulkruma.billing.currentPlan();
console.log(current.planName, current.ordersLimit);
```

### `billing.subscription`

**Signature.** `fulkruma.billing.subscription(): Promise<Record<string, unknown>>`

The subscription's state: `plan`, `planName`, `status` (lowercase: `active`, `canceling`, …), `currentPeriodStart`, `currentPeriodEnd`, `cancelAt`. Use this for "what's my state?" checks.

```ts
const sub = await fulkruma.billing.subscription();
if (sub.status === 'canceling') showRenewBanner(sub.currentPeriodEnd as string);
```

### `billing.usage`

**Signature.** `fulkruma.billing.usage(): Promise<Record<string, unknown>>`

This month's counters against the plan: `ordersFulfilled` / `ordersLimit`, `shipmentsCreated`, `licensesIssued`, and `resetAt` (the start of next month).

```ts
const usage = await fulkruma.billing.usage();
console.log(`${usage.ordersFulfilled} / ${usage.ordersLimit} orders this month`);
```

### `billing.invoices`

**Signature.** `fulkruma.billing.invoices(params?: { limit?: number; cursor?: string }): Promise<{ data: Array<Record<string, unknown>>; cursor: string | null; hasMore: boolean }>`

Invoices for Fulkruma's own subscription, newest first. `limit` defaults to 20, max 50. Pass the returned `cursor` to get the next page while `hasMore` is true. Each invoice has `id`, `plan`, `amount`, `currency`, `status`, `paidAt`, `receiptUrl`, `createdAt`.

```ts
let cursor: string | undefined;
do {
  const page = await fulkruma.billing.invoices({ limit: 50, cursor });
  for (const inv of page.data) console.log(inv.id, inv.amount, inv.status);
  cursor = page.hasMore ? page.cursor ?? undefined : undefined;
} while (cursor);
```

### `billing.checkout`

**Signature.** `fulkruma.billing.checkout(input: { plan: 'STARTER' | 'GROWTH' | 'SCALE'; email?: string; name?: string; currency?: 'IDR' | 'USD' }): Promise<{ subscriptionId: string; invoiceId: string; checkoutSessionId: string; checkoutUrl: string }>`

Starts a Plugipay subscription for the plan and returns the hosted page where the first payment is made. `email` is **required** when you call with an API key (a key has no email of its own; the portal fills it from the signed-in user). `currency` defaults by the caller's country &mdash; IDR in Indonesia, USD elsewhere.

```ts
const { checkoutUrl } = await fulkruma.billing.checkout({
  plan: 'GROWTH',
  email: 'owner@your-store.example',
});
// Redirect the merchant's browser to checkoutUrl
```

The hosted page handles card capture, 3DS and the partner-billing routing back to Fulkruma. When the invoice is paid, Plugipay notifies Fulkruma and the plan changes.

### `billing.cancel`

**Signature.** `fulkruma.billing.cancel(): Promise<Record<string, unknown>>`

Cancels the subscription **at period end** &mdash; the merchant keeps the plan until the current period closes. The request carries no body; the response is the updated subscription (as `subscription()` returns it, with `status: 'canceling'`). A workspace with no paid subscription gets its current state back unchanged.

```ts
const sub = await fulkruma.billing.cancel();
```

## Common patterns

### Render a billing dashboard

```ts
async function billingDashboard() {
  const [current, sub, usage, plans] = await Promise.all([
    fulkruma.billing.currentPlan(),
    fulkruma.billing.subscription(),
    fulkruma.billing.usage(),
    fulkruma.billing.plans(),
  ]);
  return { current, sub, usage, plans };
}
```

Parallelize the reads &mdash; they have no dependencies.

### Upgrade flow

```ts
async function upgradeTo(plan: 'STARTER' | 'GROWTH' | 'SCALE', ownerEmail: string) {
  const { checkoutUrl } = await fulkruma.billing.checkout({ plan, email: ownerEmail });
  return checkoutUrl;  // your route handler returns a 302 to this
}
```

Fulkruma sends no webhook event for plan changes; re-read `subscription()` when the merchant comes back from the hosted page.

## Errors

| Code | Status | Cause |
|---|---|---|
| `VALIDATION` | 400 | `plan` not one of `STARTER` / `GROWTH` / `SCALE`, a malformed `email`, or no email at all for an API-key caller. |
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |
| `CHECKOUT_FAILED` | 500 | Plugipay refused to start the subscription. |
| `CANCEL_FAILED` | 500 | Plugipay refused the cancellation. |
| `PLAN_NOT_CONFIGURED` | 503 | The plan has no Plugipay price set up yet. |

## Next

- [Integrations](/docs/sdk/node/resources/integrations) &mdash; check the Plugipay link status if billing isn't working.
- [API: Billing](/docs/api/resources/billing) &mdash; HTTP reference.
