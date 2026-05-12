# fulkruma (Python)

Official Python SDK for [Fulkruma](https://fulkruma.com) — stock,
warehouses, shipping, licenses, deliveries. Mirrors the Node SDK
(`@forjio/fulkruma-node`) API surface 1:1.

## Install

```bash
pip install fulkruma
```

## Quickstart

```python
from fulkruma import FulkrumaClient

client = FulkrumaClient(
    key_id="AKIAFULK...",
    secret="sk_...",
    base_url="https://fulkruma.com",          # default
)

# Create a warehouse
wh = client.warehouses.create({"name": "Jakarta DC", "city": "Jakarta"})

# Adjust stock
client.stock.adjust({
    "variantId": "var_1",
    "warehouseId": wh["warehouse"]["id"],
    "delta": 50,
    "reason": "initial_stock",
})

# List shipments
shipments = client.shipments.list(status="in_transit")
```

## Platform-admin scope

Keys with the `fulkruma:platform:admin` scope can operate against any
merchant via the `X-Fulkruma-On-Behalf-Of` header. Either pass it on the
client:

```python
admin = FulkrumaClient(key_id="...", secret="...", on_behalf_of="acc_merchant")
```

…or scope a single call:

```python
client.shipments.list(on_behalf_of="acc_merchant")
```

`for_merchant(account_id)` returns a cloned client locked to one merchant.

## Webhook verification

```python
from fulkruma import verify_webhook

# Flask
@app.post("/webhooks/fulkruma")
def hook():
    raw = request.get_data()  # bytes — verify the raw body, NOT parsed JSON
    sig = request.headers.get("Fulkruma-Signature", "")
    event = verify_webhook(raw_body=raw, signature=sig, secret=os.environ["WHSEC"])
    # event["type"], event["data"], etc.
    return "", 204
```

## Resource namespaces

| Namespace | Methods |
|---|---|
| `products` | `create`, `get`, `list`, `update`, `archive`, `add_variant`, `update_variant`, `archive_variant` |
| `warehouses` | `create`, `list`, `update`, `archive` |
| `stock` | `levels`, `movements`, `reservations`, `adjust` |
| `addresses` | `list`, `create`, `delete` |
| `shipments` | `list`, `get`, `create` |
| `shipping` | `couriers`, `origin`, `set_origin`, `rates` |
| `licenses` | `list`, `issue`, `revoke`, `activate`, `deactivate`, `validate` |
| `deliveries` | `list`, `get`, `create` |
| `api_keys` | `list`, `create`, `revoke` |
| `audit_log` | `list` |
| `billing` | `plans`, `current_plan`, `subscription`, `usage`, `invoices`, `checkout`, `cancel` |
| `integrations` | `status` |
| `stats` | `overview` |
| `webhooks` | `list_endpoints`, `create_endpoint`, `update_endpoint`, `delete_endpoint`, `list_events` |
| `admin` | `provision_workspace`, `get_workspace`, `partner_usage` |

## License

MIT
