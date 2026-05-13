---
title: Integrations
---

# Integrations

The `integrations` namespace is the **status read** for every external system Fulkruma talks to &mdash; Huudis (auth), Biteship (couriers), Plugipay (billing), Storlaunch (storefront sync). Useful for portal "connection health" pages, support diagnostics, and pre-flight checks before a big sync job. For HTTP shapes, see [**API &rarr; Integrations**](/docs/api/resources/integrations).

## Namespace

```python
fulkruma.integrations     # IntegrationsResources
```

One method. There's no `connect` or `disconnect` here &mdash; those flows live in the portal UI and OAuth callback routes, not the public API. This namespace is read-only.

## Methods

### `status`

```python
fulkruma.integrations.status(*, on_behalf_of: str | None = None) -> dict
```

Returns the current state of each integration. Every provider key may be present or absent &mdash; an absent key means "never connected"; a present key with `status: "disconnected"` means "was connected, currently broken". The shape per provider is provider-specific but always includes a `status` field.

```python
status = fulkruma.integrations.status()

if status.get("biteship", {}).get("status") != "connected":
    print("Shipping is degraded — Biteship not connected")
```

The merchant-side connection details (OAuth scopes for Huudis, API key fingerprints for Biteship, partner billing routing for Plugipay) are summarized here, **never** the raw secrets.

## Types

```python
{
    "huudis": {
        "status": "connected" | "disconnected",
        "workspaceId": "...",
        "workspaceName": "...",
        "connectedAt": "..."
    } | None,
    "biteship": {
        "status": "connected" | "disconnected" | "sandbox",
        "keyFingerprint": "...",
        "couriers": ["jne", "jnt", ...],
        "connectedAt": "..."
    } | None,
    "plugipay": {
        "status": "connected" | "disconnected",
        "accountId": "...",
        "partnerMode": bool,
        "connectedAt": "..."
    } | None,
    "storlaunch": {
        "status": "connected" | "disconnected",
        "storefrontId": "...",
        "syncEnabled": bool,
        "connectedAt": "..."
    } | None
}
```

The exact field shape per provider is documented at [**API &rarr; Integrations**](/docs/api/resources/integrations). New providers may appear over time (additional courier aggregators); old providers may drop fields. Always read defensively (`status.get("biteship", {}).get("status")`).

## Common patterns

**Pre-flight check before a big import.**

```python
def preflight(fulkruma):
    status = fulkruma.integrations.status()
    problems = []
    if status.get("huudis", {}).get("status") != "connected":
        problems.append("huudis")
    if status.get("biteship", {}).get("status") != "connected":
        problems.append("biteship")
    if status.get("plugipay", {}).get("status") != "connected":
        problems.append("plugipay")
    if problems:
        raise RuntimeError(f"Cannot proceed — broken integrations: {', '.join(problems)}")
```

Run this before kicking off a bulk product sync from Storlaunch or a big shipment batch &mdash; cheaper to fail fast.

**Portal health badge.** For a status indicator in the merchant's dashboard:

```python
def integration_health(fulkruma) -> str:
    status = fulkruma.integrations.status()
    all_ok = all(
        status.get(p, {}).get("status") == "connected"
        for p in ("huudis", "biteship", "plugipay")
    )
    return "green" if all_ok else "amber"
```

Storlaunch is excluded from the "all OK" check because not every merchant connects a storefront &mdash; treat it as opt-in.

**Detect a regression.** Compare against a previous snapshot:

```python
last_snapshot = {}

def check(fulkruma):
    global last_snapshot
    snap = fulkruma.integrations.status()
    if (
        last_snapshot.get("biteship", {}).get("status") == "connected"
        and snap.get("biteship", {}).get("status") != "connected"
    ):
        alert_slack("Biteship disconnected!")
    last_snapshot = snap
```

In practice, prefer subscribing to the `fulkruma.integration.*` webhook events instead &mdash; same signal, no polling.

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `403` | `insufficient_scope` | Key lacks `fulkruma:integration:read`. |

This namespace doesn't validate input (no input!) and doesn't 404 (it always returns *something*, even if every provider key is absent). The only realistic failure path is auth.

## Next

- [**Billing**](/docs/sdk/python/resources/billing) &mdash; the Plugipay link health matters for billing.
- [**Shipping**](/docs/sdk/python/resources/shipping) &mdash; the Biteship link health matters for rate quotes.
- [**API &rarr; Integrations**](/docs/api/resources/integrations) &mdash; HTTP-level reference.
