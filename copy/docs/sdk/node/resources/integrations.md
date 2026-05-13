---
title: Integrations
---

# Integrations

The `integrations` namespace is the **status read** for every external system Fulkruma talks to &mdash; Huudis (auth), Biteship (couriers), Plugipay (billing), Storlaunch (storefront sync). Useful for portal "connection health" pages, support diagnostics, and pre-flight checks before a big sync job. For HTTP fields, see [API: Integrations](/docs/api/resources/integrations).

## Namespace

`fulkruma.integrations` &mdash; every method:

```ts
fulkruma.integrations.status()
```

One method. There's no `connect` or `disconnect` here &mdash; those flows live in the portal UI and the OAuth callback routes, not the public API. This namespace is read-only.

## Methods

### `integrations.status`

**Signature.** `fulkruma.integrations.status(): Promise<{ huudis?: …; biteship?: …; plugipay?: …; storlaunch?: …; }>`

Returns the current state of each integration. Every provider key may be present or absent &mdash; an absent key means "never connected"; a present key with `status: 'disconnected'` means "was connected, currently broken". The shape per provider is provider-specific but always includes a `status` field.

```ts
const status = await fulkruma.integrations.status();

if (status.biteship?.status !== 'connected') {
  console.warn('Shipping is degraded — Biteship not connected');
}
```

The merchant-side connection details (OAuth scopes for Huudis, API key fingerprints for Biteship, partner billing routing for Plugipay) are summarized here, never the raw secrets.

## Types

```ts
interface IntegrationsStatus {
  huudis?: {
    status: 'connected' | 'disconnected';
    workspaceId?: string;
    workspaceName?: string;
    connectedAt?: string;
  };
  biteship?: {
    status: 'connected' | 'disconnected' | 'sandbox';
    keyFingerprint?: string;
    couriers?: string[];
    connectedAt?: string;
  };
  plugipay?: {
    status: 'connected' | 'disconnected';
    accountId?: string;
    partnerMode?: boolean;
    connectedAt?: string;
  };
  storlaunch?: {
    status: 'connected' | 'disconnected';
    storefrontId?: string;
    syncEnabled?: boolean;
    connectedAt?: string;
  };
}
```

The exact field shape per provider is documented at [API: Integrations](/docs/api/resources/integrations) and tracks the provider's own evolution. New providers may appear over time (e.g. additional courier aggregators); old providers may drop fields. Always read defensively (`status?.biteship?.status`).

## Common patterns

### Pre-flight check before a big import

```ts
async function preflight() {
  const status = await fulkruma.integrations.status();
  const problems: string[] = [];
  if (status.huudis?.status !== 'connected') problems.push('huudis');
  if (status.biteship?.status !== 'connected') problems.push('biteship');
  if (status.plugipay?.status !== 'connected') problems.push('plugipay');
  if (problems.length) {
    throw new Error(`Cannot proceed — broken integrations: ${problems.join(', ')}`);
  }
}
```

Run this before kicking off a bulk product sync from Storlaunch or a big shipment batch &mdash; cheaper to fail fast.

### Portal health badge

For a status indicator in the merchant's dashboard:

```ts
async function integrationHealth() {
  const status = await fulkruma.integrations.status();
  const allOk =
    status.huudis?.status === 'connected' &&
    status.biteship?.status === 'connected' &&
    status.plugipay?.status === 'connected';
  return allOk ? 'green' : 'amber';
}
```

Storlaunch is excluded from the "all OK" check because not every merchant connects a storefront &mdash; treat it as opt-in.

### Detect a regression

Compare against a previous snapshot:

```ts
let lastSnapshot: { biteship?: { status: string } } | null = null;

setInterval(async () => {
  const snap = await fulkruma.integrations.status();
  if (lastSnapshot?.biteship?.status === 'connected' && snap.biteship?.status !== 'connected') {
    await alertSlack('Biteship disconnected!');
  }
  lastSnapshot = snap;
}, 5 * 60_000);
```

In practice, prefer subscribing to the `fulkruma.integration.*` webhook events instead &mdash; same signal, no polling.

## Errors

| Code | Status | Cause |
|---|---|---|
| `forbidden` | 403 | Key lacks `fulkruma:integration:read` scope. |

This namespace doesn't validate input (no input!) and doesn't 404 (it always returns *something*, even if every provider key is absent). The only realistic failure path is auth.

## Next

- [Billing](/docs/sdk/node/resources/billing) &mdash; the Plugipay link health matters for billing.
- [Shipping](/docs/sdk/node/resources/shipping) &mdash; the Biteship link health matters for rate quotes.
- [API: Integrations](/docs/api/resources/integrations) &mdash; HTTP reference.
