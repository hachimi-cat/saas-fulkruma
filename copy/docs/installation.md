---
title: Installation
---

# Installation

Fulkruma ships three flavors of tooling. Pick the one that fits how you work:

- **CLI** &mdash; `fulkruma` on your terminal. Best for one-off operations, scripting, and exploration. Doesn't require a project.
- **SDK** &mdash; libraries in Node.js, Python, and Go. Best for embedding Fulkruma in an application.
- **Raw API** &mdash; if you can't or don't want to add a dependency, [the REST API](/docs/api) is fully documented and signed with HMAC.

This page covers installing the CLI and SDKs. If you want raw API access, skip ahead to the [**API authentication**](/docs/api/authentication) page.

## CLI

The CLI is published on npm as `@forjio/fulkruma-cli`. Install it globally:

```bash
npm install -g @forjio/fulkruma-cli
```

Verify the install:

```bash
fulkruma --version
```

You should see something like `fulkruma/0.x.y`. If you get `command not found`, your global npm bin directory isn't on your `PATH` &mdash; [the npm docs](https://docs.npmjs.com/cli/v10/configuring-npm/folders#executables) cover how to fix that for your shell.

<blockquote class="callout-tip">

**Prefer not to install globally?** You can run it as `npx @forjio/fulkruma-cli <command>` for one-off uses, or add it as a dev dependency on a project.

</blockquote>

The CLI authenticates against your Fulkruma workspace via Huudis device flow:

```bash
fulkruma auth login
```

## Node.js SDK

The Node SDK is `@forjio/fulkruma-node`:

```bash
npm install @forjio/fulkruma-node
```

Or with pnpm / yarn:

```bash
pnpm add @forjio/fulkruma-node
yarn add @forjio/fulkruma-node
```

It's compatible with Node 18 and later. It ships with TypeScript types out of the box.

Minimal usage:

```js
import { FulkrumaClient } from '@forjio/fulkruma-node';

const fulkruma = new FulkrumaClient({
  keyId: process.env.FULKRUMA_KEY_ID,
  secret: process.env.FULKRUMA_KEY_SECRET,
});

const { warehouses } = await fulkruma.warehouses.list();
console.log(warehouses);
```

The full reference lives at [**SDK overview**](/docs/sdk).

## Python SDK

The Python SDK is published on PyPI as `fulkruma`:

```bash
pip install fulkruma
```

It supports Python 3.9+. Dependencies: `httpx` (only).

Minimal usage:

```python
from fulkruma import FulkrumaClient
import os

fulkruma = FulkrumaClient(
    key_id=os.environ["FULKRUMA_KEY_ID"],
    secret=os.environ["FULKRUMA_KEY_SECRET"],
)

warehouses = fulkruma.warehouses.list()
print(warehouses)
```

## Go SDK

The Go SDK lives in the same repo as Fulkruma itself:

```bash
go get github.com/hachimi-cat/saas-fulkruma/sdk/go
```

Import it as `fulkruma`:

```go
import fulkruma "github.com/hachimi-cat/saas-fulkruma/sdk/go"
```

It uses only the Go standard library &mdash; no external dependencies. Requires Go 1.22+.

Minimal usage:

```go
package main

import (
    "context"
    "fmt"
    "os"

    fulkruma "github.com/hachimi-cat/saas-fulkruma/sdk/go"
)

func main() {
    client, err := fulkruma.NewClient(fulkruma.ClientOptions{
        KeyID:  os.Getenv("FULKRUMA_KEY_ID"),
        Secret: os.Getenv("FULKRUMA_KEY_SECRET"),
    })
    if err != nil {
        panic(err)
    }

    warehouses, err := client.Warehouses.List(context.Background())
    if err != nil {
        panic(err)
    }
    fmt.Println(warehouses)
}
```

## Get your API key

All three SDKs and the CLI need a Fulkruma API key. To get one:

1. Sign up at [fulkruma.com](https://fulkruma.com) &mdash; takes about a minute. See the [**Quickstart**](/docs/quickstart) for details.
2. Open the dashboard and go to **Settings &rarr; API keys**.
3. Click **Create API key** and copy the `keyId` and `secret` immediately &mdash; we don't show the secret again.

The convention across SDKs is to read credentials from environment variables:

| Variable | Purpose |
|---|---|
| `FULKRUMA_KEY_ID` | Public key identifier &mdash; safe to commit |
| `FULKRUMA_KEY_SECRET` | Secret key &mdash; never commit, never log |
| `FULKRUMA_BASE_URL` | Optional &mdash; only set if you're pointing at staging or a self-hosted Fulkruma instance |

<blockquote class="callout-warn">

**Don't bake the secret into source.** Use your environment's secret manager. For local dev, a gitignored `.env` file plus `dotenv` is fine. For production, use AWS Secrets Manager, Vault, or your platform's equivalent.

</blockquote>

If you'd rather pass the credentials explicitly:

```js
const fulkruma = new FulkrumaClient({ keyId: 'AKIA...', secret: '...' });
```

## Sandbox &amp; staging

If you want to test against a non-production Fulkruma instance &mdash; say to verify behavior before we ship a release &mdash; you can point any SDK or the CLI at staging:

```bash
export FULKRUMA_BASE_URL=https://staging.fulkruma.com
```

Keys minted in production don't work in staging and vice versa. We can issue staging keys on request &mdash; email hello@fulkruma.com if you're building an integration that needs them.

## Next: ship a test order

You're ready. Head back to the [**Quickstart**](/docs/quickstart) for the end-to-end walkthrough.
