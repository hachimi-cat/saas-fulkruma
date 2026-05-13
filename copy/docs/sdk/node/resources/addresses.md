---
title: Addresses
---

# Addresses

An **address** is a shipping destination stored against a customer. Each customer can have many addresses (home, office, parent's place); one can be flagged `isDefault` to pre-select in checkout. This page covers the `fulkruma.addresses` namespace. For HTTP fields, see [API: Addresses](/docs/api/resources/addresses).

## Namespace

`fulkruma.addresses` &mdash; every method:

```ts
fulkruma.addresses.list(params?)
fulkruma.addresses.create(input)
fulkruma.addresses.delete(id)
```

Three methods. There's no `update` &mdash; addresses are immutable after create (the data model treats edits as delete-then-create so historic shipments keep pointing to the address that was actually shipped to). There's no `get(id)` &mdash; `list({ customer_id })` is the only read path.

## Methods

### `addresses.list`

**Signature.** `fulkruma.addresses.list(params?): Promise<{ addresses: CustomerAddress[] }>`

Returns every address in the workspace. Pass `customer_id` to scope to a single customer's address book.

```ts
const { addresses } = await fulkruma.addresses.list({ customer_id: 'cus_01HX...' });
const def = addresses.find((a) => a.isDefault);
```

Not paginated &mdash; we expect a handful of addresses per customer, not thousands.

### `addresses.create`

**Signature.** `fulkruma.addresses.create(input): Promise<{ address: CustomerAddress }>`

Creates an address. `customerId`, `label`, `contactName`, `contactPhone`, and `address` are required. `postalCode` and `areaId` (Biteship's area identifier) are required for any address you'll actually ship to &mdash; the routing engine needs them. The SDK does **not** auto-mint an `Idempotency-Key`; addresses can have legitimate duplicates so the operation is treated as naturally non-idempotent.

```ts
const { address } = await fulkruma.addresses.create({
  customerId: 'cus_01HX...',
  label: 'Home',
  contactName: 'Alice Tan',
  contactPhone: '+62812xxxxxxxx',
  email: 'alice@example.com',
  address: 'Jl. Diponegoro No. 5',
  postalCode: '10310',
  areaId: 'IDN-JKT-MTH',
  lat: -6.2088,
  lng: 106.8456,
  isDefault: true,
});

console.log(address.id);  // → 'addr_01HX...'
```

Setting `isDefault: true` clears the flag on whichever address currently holds it &mdash; one default per customer, swap is transactional.

### `addresses.delete`

**Signature.** `fulkruma.addresses.delete(id): Promise<{ deleted: boolean }>`

Hard-deletes an address. **Historic shipments keep pointing to a snapshot of the destination** stored on the shipment itself, so deletion doesn't break audit trails &mdash; the address just disappears from the customer's address book.

```ts
await fulkruma.addresses.delete('addr_01HX...');
```

If you delete the current default, the customer is left without one until you flag another or create a fresh address with `isDefault: true`.

## Types

```ts
interface CustomerAddress {
  id: string;              // 'addr_...'
  accountId: string;
  customerId: string;
  label: string;           // 'Home', 'Office', etc.
  contactName: string;
  contactPhone: string;
  email: string | null;
  address: string;
  postalCode: string | null;
  areaId: string | null;   // Biteship area code
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
  createdAt: string;
}
```

For the full `areaId` vocabulary (Biteship's area codes), see [API: Addresses](/docs/api/resources/addresses).

## Common patterns

### First-time setup with default flag

```ts
async function captureFirstAddress(customerId: string, input: { contactName: string; address: string; postalCode: string; areaId: string; contactPhone: string }) {
  const { addresses } = await fulkruma.addresses.list({ customer_id: customerId });
  const isFirst = addresses.length === 0;
  return fulkruma.addresses.create({
    customerId,
    label: 'Home',
    ...input,
    isDefault: isFirst,
  });
}
```

### "Edit" via delete-then-create

Since the resource is immutable, the closest thing to "edit" is replace:

```ts
async function replaceAddress(oldId: string, customerId: string, fresh: { label: string; contactName: string; contactPhone: string; address: string; postalCode: string; areaId: string }) {
  const { addresses } = await fulkruma.addresses.list({ customer_id: customerId });
  const old = addresses.find((a) => a.id === oldId);
  const wasDefault = old?.isDefault ?? false;
  await fulkruma.addresses.delete(oldId);
  return fulkruma.addresses.create({
    customerId,
    ...fresh,
    isDefault: wasDefault,
  });
}
```

### Default-address resolver

For routing a shipment when the caller didn't specify which address to ship to:

```ts
async function defaultAddress(customerId: string) {
  const { addresses } = await fulkruma.addresses.list({ customer_id: customerId });
  return addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
}
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Missing required fields, bad phone format, postal too long. |
| `not_found` | 404 | Customer or address ID missing. |
| `forbidden` | 403 | Key lacks `fulkruma:address:write` scope. |

See [Errors](/docs/sdk/node/errors) for the full hierarchy.

## Next

- [Shipments](/docs/sdk/node/resources/shipments) &mdash; addresses are the destination half of every parcel.
- [Shipping](/docs/sdk/node/resources/shipping) &mdash; rate quotes use the address `areaId` and `postalCode`.
- [API: Addresses](/docs/api/resources/addresses) &mdash; HTTP reference.
