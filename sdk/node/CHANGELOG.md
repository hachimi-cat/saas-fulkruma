# Changelog

## 0.5.0
- Requests sign exactly the bytes they send. A call that carries nothing — `licenses.revoke`, `apiKeys.revoke`, `billing.cancel`, or any body that serialises to `{}` / `[]` — now sends no body and signs none; it used to send and sign `{}`, which the server hashed as the empty string, so those calls failed with BAD_SIGNATURE.
- `apiKeys.create({ name, scopes? })`: the server requires `name` (and takes `scopes`: read / write / admin); `description` and `scope` were never read. `apiKeys.revoke` returns `{ apiKey: { id, revokedAt } }`, what the server sends.
- `auditLog.list({ action?, target_type?, limit? })`: the filters the server reads (`action` is a prefix). `cursor`, `since` and `eventType` were ignored.
- `billing.checkout({ plan: 'STARTER' | 'GROWTH' | 'SCALE', email?, name? })` returns `{ subscriptionId, invoiceId, checkoutSessionId, checkoutUrl }`; it sent `planId` / `successUrl` / `cancelUrl`, which the server rejects.
- `webhooks.listEvents()` takes no parameters: the server returns the 50 most recent events and ignored `limit` / `cursor` / `type`.
- `ProductCreateInput` and `VariantCreateInput` no longer list `externalRef` / `externalSource`, which the server drops.
- A test checks every hand-written method's route against the API spec (`backend/openapi.json`).

## 0.4.2
- `client.api`: every feature route of the Fulkruma API, one method each (`client.api.<area><Action>(...)`), generated from the backend's own code (scripts/apigen.sh) and signed like every other call.

## 0.4.1
- Package metadata now points at the public mirror repo (github.com/hachimi-cat/fulkruma-node).

## 0.4.0
- Prior release.
