---
title: Addresses
---

# Addresses

An address is a shipping destination stored against a customer. Each customer can have many addresses (home, office, parent's place); one can be flagged `isDefault` to pre-select in checkout. The Python SDK wraps three endpoints behind `fulkruma.addresses`. For HTTP shapes, see [**API &rarr; Addresses**](/docs/api/resources/addresses).

## Namespace

```python
fulkruma.addresses     # AddressesResources
```

Three methods. There's no `update` &mdash; addresses are immutable after create (the data model treats edits as delete-then-create so historic shipments keep pointing to the address that was actually shipped to). There's no `get(id)` &mdash; `list(customer_id=...)` is the only read path.

## Methods

### `list`

```python
fulkruma.addresses.list(
    *,
    customer_id: str | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Returns every address in the workspace. Pass `customer_id` to scope to a single customer's address book.

```python
result = fulkruma.addresses.list(customer_id="cus_01HX...")
default = next((a for a in result["addresses"] if a.get("isDefault")), None)
```

Not paginated &mdash; we expect a handful of addresses per customer, not thousands.

### `create`

```python
fulkruma.addresses.create(body: dict, *, on_behalf_of: str | None = None) -> dict
```

Creates an address. `customerId`, `label`, `contactName`, `contactPhone`, and `address` are required. `postalCode` and `areaId` are required for any address you'll actually ship to. The SDK does **not** auto-mint an idempotency key &mdash; addresses can have legitimate duplicates.

```python
result = fulkruma.addresses.create({
    "customerId": "cus_01HX...",
    "label": "Home",
    "contactName": "Alice Tan",
    "contactPhone": "+62812xxxxxxxx",
    "email": "alice@example.com",
    "address": "Jl. Diponegoro No. 5",
    "postalCode": "10310",
    "areaId": "IDN-JKT-MTH",
    "lat": -6.2088,
    "lng": 106.8456,
    "isDefault": True,
})
print(result["address"]["id"])
```

Setting `isDefault: True` clears the flag on whichever address currently holds it &mdash; one default per customer, swap is transactional.

### `delete`

```python
fulkruma.addresses.delete(address_id: str, *, on_behalf_of: str | None = None) -> dict
```

Hard-deletes an address. **Historic shipments keep pointing to a snapshot** stored on the shipment itself, so deletion doesn't break audit trails &mdash; the address just disappears from the customer's address book.

```python
fulkruma.addresses.delete("addr_01HX...")
```

## Types

Each method returns a dict with the API envelope. Key shape:

```python
{
    "address": {
        "id": "addr_...",
        "accountId": "acc_...",
        "customerId": "cus_...",
        "label": "Home",
        "contactName": "...",
        "contactPhone": "+62...",
        "email": "..." | None,
        "address": "...",
        "postalCode": "..." | None,
        "areaId": "IDN-JKT-..." | None,
        "lat": float | None,
        "lng": float | None,
        "isDefault": bool,
        "createdAt": "..."
    }
}
```

For the full `areaId` vocabulary (Biteship's area codes), see [**API &rarr; Addresses**](/docs/api/resources/addresses).

## Common patterns

**First-time setup with default flag.**

```python
def capture_first_address(fulkruma, customer_id: str, attrs: dict):
    existing = fulkruma.addresses.list(customer_id=customer_id)
    is_first = len(existing["addresses"]) == 0
    return fulkruma.addresses.create({
        "customerId": customer_id,
        "label": "Home",
        **attrs,
        "isDefault": is_first,
    })
```

**"Edit" via delete-then-create.** The resource is immutable; the closest thing to "edit" is replace:

```python
def replace_address(fulkruma, old_id: str, customer_id: str, fresh: dict):
    existing = fulkruma.addresses.list(customer_id=customer_id)
    old = next((a for a in existing["addresses"] if a["id"] == old_id), None)
    was_default = bool(old and old.get("isDefault"))
    fulkruma.addresses.delete(old_id)
    return fulkruma.addresses.create({
        "customerId": customer_id,
        **fresh,
        "isDefault": was_default,
    })
```

**Default-address resolver.** For routing a shipment when the caller didn't specify which address to ship to:

```python
def default_address(fulkruma, customer_id: str):
    existing = fulkruma.addresses.list(customer_id=customer_id)
    addresses = existing["addresses"]
    return next(
        (a for a in addresses if a.get("isDefault")),
        addresses[0] if addresses else None,
    )
```

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Missing required fields, bad phone format, postal too long. |
| `404` | `not_found` | Customer or address ID missing. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:address:write`. |

## Next

- [**Shipments**](/docs/sdk/python/resources/shipments) &mdash; addresses are the destination half of every parcel.
- [**Shipping**](/docs/sdk/python/resources/shipping) &mdash; rate quotes use the address `areaId` and `postalCode`.
- [**API &rarr; Addresses**](/docs/api/resources/addresses) &mdash; HTTP-level reference.
