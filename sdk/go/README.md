# fulkruma (Go)

Official Go SDK for [Fulkruma](https://fulkruma.com) — stock,
warehouses, shipping (Biteship), licenses, deliveries, API keys, audit
log, billing, integrations status, stats, webhooks. Mirrors the Node
(`@forjio/fulkruma-node`) and Python (`fulkruma`) SDKs 1:1.

## Install

```bash
go get github.com/hachimi-cat/saas-fulkruma/sdk/go
```

Requires Go 1.22+. No third-party dependencies — pure stdlib.

## Quickstart

Env vars (or pass them to `NewClient`):

```bash
FULKRUMA_KEY_ID=AKIAFULK...
FULKRUMA_SECRET=...
FULKRUMA_BASE_URL=https://fulkruma.com    # optional, this is the default
FULKRUMA_ON_BEHALF_OF=acc_...             # optional, platform-admin only
```

### List products

```go
package main

import (
    "context"
    "fmt"

    fulkruma "github.com/hachimi-cat/saas-fulkruma/sdk/go"
)

func main() {
    c, err := fulkruma.NewClient(fulkruma.ClientOptions{})
    if err != nil { panic(err) }

    products, err := c.Products.List(context.Background(), fulkruma.ProductListParams{})
    if err != nil { panic(err) }
    for _, p := range products {
        fmt.Printf("%s — %s\n", p.ID, p.Name)
    }
}
```

### Verify an inbound webhook

```go
http.HandleFunc("/webhooks/fulkruma", func(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    event, err := fulkruma.VerifyWebhook(
        body,
        r.Header.Get("Fulkruma-Signature"),
        os.Getenv("FULKRUMA_WEBHOOK_SECRET"),
        nil,
    )
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    log.Printf("got %s event %s", event.Type, event.ID)
    w.WriteHeader(204)
})
```

### Platform admin (Pattern 2)

```go
// One client per request, scoped to a merchant.
scoped := c.ForMerchant("acc_merchant_123")
warehouses, _ := scoped.Warehouses.List(ctx)

// Or override per call:
scoped, _ := c.Warehouses.List(ctx)  // not really shown — Warehouses.List doesn't take OBO,
                                     // but Request() does via RequestOptions.OnBehalfOf.
```

## Surface

| Namespace | Purpose |
|---|---|
| `c.Products` | Products + variants |
| `c.Warehouses` | Stock locations |
| `c.Stock` | Levels, movements, reservations, adjust |
| `c.Addresses` | Customer ship-to addresses |
| `c.Shipments` | Outbound shipments (Biteship) |
| `c.Shipping` | Couriers, rates, origin config |
| `c.Licenses` | Digital licenses + public activation/validate |
| `c.Deliveries` | Digital download links |
| `c.APIKeys` | HMAC key management |
| `c.AuditLog` | Cursor-paginated audit trail |
| `c.Billing` | Merchant subscription to Fulkruma |
| `c.Integrations` | Per-provider status |
| `c.Stats` | Dashboard overview counters |
| `c.Webhooks` | Endpoints + event log (control plane) |
| `c.Admin` | Platform-admin partner billing |

| Function | Purpose |
|---|---|
| `VerifyWebhook(body, header, secret, opts)` | Validate Fulkruma-Signature header and parse envelope. |
| `*Error` | Single error type — branch on `.Code` and `.Status`. |

## HMAC signing

Every request is signed:

```
Authorization: Fulkruma-HMAC-SHA256 keyId=<id>, scope=*, signature=<hex>
X-Fulkruma-Timestamp: <unix>
```

Where `signature = HMAC-SHA256(secret, "${METHOD}\n${path}\n${ts}\n${sha256(body)}[\n${idempotency_key}]")`.

The body bytes that get signed are the bytes that get sent —
`encoding/json.Marshal` produces compact output by default, matching the
Node SDK's `JSON.stringify` and the Python SDK's
`json.dumps(separators=(',',':'))`.

## Docs

- Full docs: <https://fulkruma.com/docs>
- Source: <https://github.com/hachimi-cat/saas-fulkruma/tree/master/sdk/go>

## License

MIT
