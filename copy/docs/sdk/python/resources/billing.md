---
title: Billing
---

# Billing

The `billing` namespace is the **merchant's subscription to Fulkruma itself** &mdash; not the merchant's billing of their own end customers. Read plans, the current subscription, usage, and invoices; redirect to a hosted checkout to upgrade; cancel. Under the hood this is all powered by Plugipay (Pattern 2 partner-billing), but the SDK exposes a flat surface. For HTTP shapes, see [**API &rarr; Billing**](/docs/api/resources/billing).

## Namespace

```python
fulkruma.billing     # BillingResources
```

Seven methods. Six reads + cancel + a checkout-redirect builder. There's no "upgrade in place" &mdash; every plan change goes through `checkout`, which returns a hosted URL on `pay.plugipay.com`.

## Methods

### `plans`

```python
fulkruma.billing.plans(*, on_behalf_of: str | None = None) -> list
```

Returns every plan Fulkruma offers. Each plan has an `id`, name, price, and feature/limit map. Cache for the page lifetime; plans change rarely.

```python
plans = fulkruma.billing.plans()
for p in plans:
    print(f"{p['name']} — Rp{p['priceCents'] / 100}")
```

### `current_plan`

```python
fulkruma.billing.current_plan(*, on_behalf_of: str | None = None) -> dict
```

The merchant's current plan. Identical shape to one entry in `plans()`, plus a `currentPeriodEnd` timestamp.

```python
current = fulkruma.billing.current_plan()
```

### `subscription`

```python
fulkruma.billing.subscription(*, on_behalf_of: str | None = None) -> dict
```

The full subscription object &mdash; status, period, cancel-at-end flag, Plugipay subscription ID, the merchant-side payment method ID.

```python
sub = fulkruma.billing.subscription()
if sub["status"] == "past_due":
    notify_merchant()
```

### `usage`

```python
fulkruma.billing.usage(*, on_behalf_of: str | None = None) -> dict
```

Current period's metered usage &mdash; shipment count, stock movement count, license issuance count &mdash; against the plan's caps. The portal's `/billing` page renders this.

```python
usage = fulkruma.billing.usage()
# usage["shipments"] = {"used": 412, "limit": 1000} (shape evolves per plan)
```

### `invoices`

```python
fulkruma.billing.invoices(
    *,
    limit: int | None = None,
    cursor: str | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Cursor-paginated invoice list. `limit` defaults to 25, max 100.

```python
cursor = None
while True:
    result = fulkruma.billing.invoices(limit=50, cursor=cursor)
    for inv in result["invoices"]:
        print(inv)
    cursor = result.get("nextCursor")
    if not cursor:
        break
```

### `checkout`

```python
fulkruma.billing.checkout(body: dict, *, on_behalf_of: str | None = None) -> dict
```

Creates a Plugipay-hosted checkout session for upgrading/changing plans. Pass the target `planId` (from `plans()`) and optional success/cancel URLs.

```python
result = fulkruma.billing.checkout({
    "planId": "plan_growth",
    "successUrl": "https://your-portal.example.com/billing?ok=1",
    "cancelUrl": "https://your-portal.example.com/billing?cancelled=1",
})
# Redirect the merchant's browser to result["url"]
```

The hosted URL handles card capture + 3DS + the partner-billing routing back to Fulkruma. On success, Plugipay calls our internal webhook which updates the subscription; the merchant lands on `successUrl`.

### `cancel`

```python
fulkruma.billing.cancel(*, on_behalf_of: str | None = None) -> dict
```

Cancels the subscription **at period end** &mdash; the merchant keeps access until the current period closes.

```python
fulkruma.billing.cancel()
```

Idempotent &mdash; calling on an already-cancelling subscription is a no-op. To un-cancel, run `checkout` against the same plan again.

## Types

The billing namespace returns intentionally-loose shapes because the per-plan feature map and per-invoice line-item shape evolve faster than the SDK release cycle. Stable fields:

- `plans[]["id"]`, `plans[]["name"]`, `plans[]["priceCents"]`
- `subscription["status"]` &mdash; `"active" | "trialing" | "past_due" | "cancelled" | "incomplete"`
- `subscription["currentPeriodEnd"]` &mdash; ISO-8601
- `invoices[]["id"]`, `invoices[]["amountCents"]`, `invoices[]["paidAt"]`
- `checkout["url"]` &mdash; the Plugipay-hosted URL to redirect to

See [**API &rarr; Billing**](/docs/api/resources/billing) for the per-version field map.

## Common patterns

**Render a billing dashboard.** Three independent reads &mdash; parallelize with `concurrent.futures`:

```python
from concurrent.futures import ThreadPoolExecutor

def billing_dashboard(fulkruma):
    with ThreadPoolExecutor(max_workers=3) as ex:
        sub = ex.submit(fulkruma.billing.subscription)
        usage = ex.submit(fulkruma.billing.usage)
        plans = ex.submit(fulkruma.billing.plans)
    return {
        "subscription": sub.result(),
        "usage": usage.result(),
        "plans": plans.result(),
    }
```

**Upgrade flow.**

```python
import os

def upgrade_to(fulkruma, plan_id: str) -> str:
    result = fulkruma.billing.checkout({
        "planId": plan_id,
        "successUrl": f"{os.environ['PORTAL_URL']}/billing?upgrade=success",
        "cancelUrl": f"{os.environ['PORTAL_URL']}/billing?upgrade=cancelled",
    })
    return result["url"]  # your route handler returns a 302 to this
```

**Listen for plan changes.** Don't poll `subscription()`; subscribe to `fulkruma.subscription.updated`:

```python
fulkruma.webhooks.create_endpoint({
    "url": "https://your-portal.example.com/webhooks/fulkruma",
    "events": ["fulkruma.subscription.updated"],
})
```

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Unknown `planId`, bad URL format on checkout. |
| `404` | `not_found` | Plan ID doesn't exist; merchant has no subscription yet. |
| `409` | `conflict` | Checkout on a plan the merchant already has; cancel on an already-cancelled sub. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:billing:read` / `:write`. |
| `502` | `plugipay_error` | Upstream Plugipay returned an error. |

`plugipay_error` is the retry candidate.

## Next

- [**Integrations**](/docs/sdk/python/resources/integrations) &mdash; check the Plugipay link status if billing isn't working.
- [**API &rarr; Billing**](/docs/api/resources/billing) &mdash; HTTP reference.
- [**Webhooks**](/docs/sdk/python/resources/webhooks) &mdash; subscribe to `subscription.updated`.
