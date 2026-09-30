---
title: Billing
---

# Billing

The `billing` namespace is the **merchant's subscription to Fulkruma itself** &mdash; not the merchant's billing of their own end customers. Read plans, the current plan and subscription, usage, and invoices; start a hosted checkout to upgrade; cancel. Under the hood this is all powered by Plugipay (Pattern 2 partner-billing), but the SDK exposes a flat surface. For HTTP shapes, see [**API &rarr; Billing**](/docs/api/resources/billing).

## Namespace

```python
fulkruma.billing     # BillingResources
```

Seven methods: five reads, a checkout and a cancel. There's no "upgrade in place" &mdash; every plan change goes through `checkout`, which returns a hosted Plugipay URL.

## Methods

### `plans`

```python
fulkruma.billing.plans(*, on_behalf_of: str | None = None) -> list
```

Every plan Fulkruma offers: `free`, `starter`, `growth`, `scale`. Each has an `id`, `name`, `price` (in IDR), `currency` (`"IDR"`) and `features` (display strings). No credentials needed.

```python
for p in fulkruma.billing.plans():
    print(f"{p['name']} — Rp{p['price']:,}/month")
```

### `current_plan`

```python
fulkruma.billing.current_plan(*, on_behalf_of: str | None = None) -> dict
```

The workspace's plan and its limits: `plan`, `planName`, `ordersLimit`, `warehousesLimit`, `licenseKeysLimit`, `apiKeysLimit`, `webhookEndpointsLimit`, `rateLimit`, `biteshipShipmentsLimit` (each `-1` for unlimited) and `billingCycleEnd`.

```python
current = fulkruma.billing.current_plan()
print(current["planName"], current["ordersLimit"])
```

### `subscription`

```python
fulkruma.billing.subscription(*, on_behalf_of: str | None = None) -> dict
```

The subscription's state: `plan`, `planName`, `status` (lowercase: `active`, `canceling`, …), `currentPeriodStart`, `currentPeriodEnd`, `cancelAt`.

```python
sub = fulkruma.billing.subscription()
if sub["status"] == "canceling":
    show_renew_banner(sub["currentPeriodEnd"])
```

### `usage`

```python
fulkruma.billing.usage(*, on_behalf_of: str | None = None) -> dict
```

This month's counters against the plan: `ordersFulfilled` / `ordersLimit`, `shipmentsCreated`, `licensesIssued`, and `resetAt` (the start of next month).

```python
usage = fulkruma.billing.usage()
print(f"{usage['ordersFulfilled']} / {usage['ordersLimit']} orders this month")
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

Invoices for Fulkruma's own subscription, newest first: `{"data": [...], "cursor": ..., "hasMore": ...}`. `limit` defaults to 20, max 50. Pass the returned `cursor` to get the next page while `hasMore` is true. Each invoice has `id`, `plan`, `amount`, `currency`, `status`, `paidAt`, `receiptUrl`, `createdAt`.

```python
cursor = None
while True:
    page = fulkruma.billing.invoices(limit=50, cursor=cursor)
    for inv in page["data"]:
        print(inv["id"], inv["amount"], inv["status"])
    if not page["hasMore"]:
        break
    cursor = page["cursor"]
```

### `checkout`

```python
fulkruma.billing.checkout(body: dict, *, on_behalf_of: str | None = None) -> dict
```

Starts a Plugipay subscription for the plan and returns the hosted page where the first payment is made. `body`:

| Key | Required | Meaning |
|---|---|---|
| `plan` | yes | `"STARTER"`, `"GROWTH"` or `"SCALE"`. |
| `email` | with an API key | The billing contact. A key has no email of its own; the portal fills it from the signed-in user. |
| `name` | no | The billing contact's name. |
| `currency` | no | `"IDR"` or `"USD"`; defaults by the caller's country (IDR in Indonesia, USD elsewhere). |

The result has `subscriptionId`, `invoiceId`, `checkoutSessionId` and `checkoutUrl`.

```python
result = fulkruma.billing.checkout({"plan": "GROWTH", "email": "owner@your-store.example"})
# Redirect the merchant's browser to result["checkoutUrl"]
```

The hosted page handles card capture, 3DS and the partner-billing routing back to Fulkruma. When the invoice is paid, Plugipay notifies Fulkruma and the plan changes.

### `cancel`

```python
fulkruma.billing.cancel(*, on_behalf_of: str | None = None) -> dict
```

Cancels the subscription **at period end** &mdash; the merchant keeps the plan until the current period closes. The request carries no body; the result is the updated subscription (as `subscription()` returns it, with `status` `"canceling"`). A workspace with no paid subscription gets its current state back unchanged.

## Common patterns

**Render a billing dashboard.**

```python
def billing_dashboard(fulkruma):
    return {
        "current": fulkruma.billing.current_plan(),
        "subscription": fulkruma.billing.subscription(),
        "usage": fulkruma.billing.usage(),
        "plans": fulkruma.billing.plans(),
    }
```

**Upgrade flow.**

```python
def upgrade_to(fulkruma, plan: str, owner_email: str) -> str:
    result = fulkruma.billing.checkout({"plan": plan, "email": owner_email})
    return result["checkoutUrl"]   # your route handler returns a 302 to this
```

Fulkruma sends no webhook event for plan changes; re-read `subscription()` when the merchant comes back from the hosted page.

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `VALIDATION` | `plan` not one of `STARTER` / `GROWTH` / `SCALE`, a malformed `email`, or no email at all for an API-key caller. |
| `403` | `NO_ACCOUNT` | The credentials resolve to no workspace. |
| `500` | `CHECKOUT_FAILED` | Plugipay refused to start the subscription. |
| `500` | `CANCEL_FAILED` | Plugipay refused the cancellation. |
| `503` | `PLAN_NOT_CONFIGURED` | The plan has no Plugipay price set up yet. |

## Next

- [**Integrations**](/docs/sdk/python/resources/integrations) &mdash; check the Plugipay link status if billing isn't working.
- [**API &rarr; Billing**](/docs/api/resources/billing) &mdash; HTTP reference.
