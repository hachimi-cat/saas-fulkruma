---
title: SDKs
---

# SDKs

Fulkruma ships SDKs in three languages, with feature parity across all three. Pick the one for your stack:

| Language | Package | Install |
|---|---|---|
| Node.js | `@forjio/fulkruma-node` | `npm install @forjio/fulkruma-node` |
| Python | `fulkruma` | `pip install fulkruma` |
| Go | `github.com/hachimi-cat/saas-fulkruma/sdk/go` | `go get github.com/hachimi-cat/saas-fulkruma/sdk/go` |

All three:

- Implement the same surface: every API resource is exposed as a typed method.
- Handle HMAC signing automatically &mdash; you provide the key, they sign every request.
- Provide a `verifyWebhook` helper for inbound events.
- Support **Pattern 2 partner billing** &mdash; pass `onBehalfOf` to scope a platform-admin key to a merchant workspace.
- Use only minimal dependencies (Node: stdlib + native fetch; Python: `httpx`; Go: stdlib).
- Are open source: code is in the [saas-fulkruma](https://github.com/hachimi-cat/saas-fulkruma) repo under `sdk/<lang>/`.

## When to use which

If your existing stack is in Node, Python, or Go: use the matching SDK. There's no perf or feature reason to use one over another &mdash; pick your language.

If your stack is in another language (Ruby, PHP, Rust, Java, Elixir, etc.): use the [**raw API**](/docs/api). HMAC signing is straightforward &mdash; we have customers integrating in all of those languages without an SDK.

## Quick comparison

Same call in three languages &mdash; create a warehouse:

**Node.js:**

```js
import { FulkrumaClient } from '@forjio/fulkruma-node';

const fulkruma = new FulkrumaClient({
  keyId: process.env.FULKRUMA_KEY_ID,
  secret: process.env.FULKRUMA_KEY_SECRET,
});

const { warehouse } = await fulkruma.warehouses.create({
  name: 'Main warehouse',
  city: 'Jakarta',
  postal: '12345',
});
```

**Python:**

```python
from fulkruma import FulkrumaClient
import os

fulkruma = FulkrumaClient(
    key_id=os.environ["FULKRUMA_KEY_ID"],
    secret=os.environ["FULKRUMA_KEY_SECRET"],
)

warehouse = fulkruma.warehouses.create(
    name="Main warehouse",
    city="Jakarta",
    postal="12345",
)
```

**Go:**

```go
import fulkruma "github.com/hachimi-cat/saas-fulkruma/sdk/go"

client, _ := fulkruma.NewClient(fulkruma.ClientOptions{
    KeyID:  os.Getenv("FULKRUMA_KEY_ID"),
    Secret: os.Getenv("FULKRUMA_KEY_SECRET"),
})

wh, _ := client.Warehouses.Create(ctx, fulkruma.WarehouseInput{
    Name:   "Main warehouse",
    City:   "Jakarta",
    Postal: "12345",
})
```

The differences are purely idiomatic: `camelCase` in Node, `snake_case` in Python, `PascalCase` in Go. The underlying API call is identical.

## Pattern 2: scoping to a merchant

If you hold a platform-admin key (you're Storlaunch, Ripllo, or another Forjio partner), you can scope a single client to a specific merchant workspace using `forMerchant`:

```js
const platformClient = new FulkrumaClient({
  keyId: process.env.FULKRUMA_PLATFORM_KEY_ID,
  secret: process.env.FULKRUMA_PLATFORM_KEY_SECRET,
});

// Scope to a specific merchant for a series of calls
const merchantClient = platformClient.forMerchant('acc_01H...');
const { shipment } = await merchantClient.shipments.create({ /* ... */ });
```

Every call from `merchantClient` automatically sends `X-Fulkruma-On-Behalf-Of`. The underlying HMAC key stays the platform's; audit log entries record both.

For a one-off, pass `onBehalfOf` per request:

```js
await platformClient.shipments.create({ /* body */ }, { onBehalfOf: 'acc_01H...' });
```

## Resource coverage

All three SDKs cover every API resource:

- `warehouses` &mdash; CRUD on warehouses
- `products` &mdash; products + variants
- `stock` &mdash; levels, movements, reservations, adjustments
- `addresses` &mdash; customer address book
- `shipments` &mdash; create, get, list
- `shipping` &mdash; rates, couriers, origin config
- `deliveries` &mdash; digital fulfilment
- `licenses` &mdash; issue, revoke, activate, deactivate, validate
- `apiKeys` &mdash; manage workspace keys
- `webhooks` &mdash; endpoints + events
- `auditLog` &mdash; the audit trail
- `billing` &mdash; merchant subscription to Fulkruma
- `integrations` &mdash; status of Huudis, Biteship, Plugipay, Storlaunch
- `stats` &mdash; dashboard counters and recents
- `admin` &mdash; platform-admin operations (Pattern 2)

## Versioning

All SDKs follow semantic versioning:

- **MAJOR** bumps for breaking changes (rare; we'll batch them).
- **MINOR** bumps for new features.
- **PATCH** bumps for fixes.

Current versions (as of 2026-05-12):

- Node: `0.2.x`
- Python: `0.1.x`
- Go: `0.1.x`

Pre-1.0 means we may still make small breaking changes between minor versions. We document every break in the changelog.

## Open-source

The SDKs live in the same repo as Fulkruma itself:

- Node: [saas-fulkruma/sdk/node](https://github.com/hachimi-cat/saas-fulkruma/tree/master/sdk/node)
- Python: [saas-fulkruma/sdk/python](https://github.com/hachimi-cat/saas-fulkruma/tree/master/sdk/python)
- Go: [saas-fulkruma/sdk/go](https://github.com/hachimi-cat/saas-fulkruma/tree/master/sdk/go)

Issues at [github.com/hachimi-cat/saas-fulkruma/issues](https://github.com/hachimi-cat/saas-fulkruma/issues).

## Next

- [**Installation**](/docs/installation) &mdash; if you haven't installed an SDK yet.
- [**Concepts**](/docs/concepts) &mdash; the data model the SDKs expose.
- [**API reference**](/docs/api) &mdash; the underlying HTTP API.
