# Changelog

## Unreleased
- Three more event types arrive at your endpoints (and through `verifyWebhook` like any other): `fulkruma.stock.low.v1` (a level falls below its variant's `lowStockThreshold`, once per crossing), `fulkruma.warehouse.created.v1` and `fulkruma.webhook_endpoint.disabled.v1` (Fulkruma switched off one of your other endpoints that kept failing).
- `client.api`: regenerated. A GET by id next to a list of the same name is `get…`: `webhooksGetEvents(id)` and `shippingGetShipments(id)`. The old names `webhooksEvents2` and `shippingShipments2` still work, marked `@deprecated`. `shippingTrack(waybillId, { courier })` requires `courier`, which the server always did.

## 0.6.0
- Fulkruma now delivers webhooks to the endpoints you register (it never did before — the delivery log was always empty). `webhooks.listEvents` reads that log: one row per event per endpoint with its `status` (`pending` / `sent` / `failed`), `attempts`, `nextRetryAt`, `lastError` and every attempt made (`deliveryAttempts`), typed as `WebhookDelivery`.
- `webhooks.listEvents({ limit?, cursor?, type?, status?, endpointId? })` filters and pages (it returns `nextCursor`); `webhooks.getEvent(id)` reads one delivery; `webhooks.retryEvent(id)` queues another attempt now.
- `verifyWebhook` is tested against a signature the server made (a vector shared with the backend and the Python and Go SDKs).
- `client.api`: regenerated — `webhooksEvents` takes the filters, `webhooksEvents2(id)` and `webhooksEventsRetry(id)` are new.

## 0.5.0
- Requests sign exactly the bytes they send. A call that carries nothing — `licenses.revoke`, `apiKeys.revoke`, `billing.cancel`, or any body that serialises to `{}` / `[]` — now sends no body and signs none; it used to send and sign `{}`, which the server hashed as the empty string, so those calls failed with BAD_SIGNATURE.
- `apiKeys.create({ name, scopes? })`: the server requires `name` (and takes `scopes`: read / write / admin); `description` and `scope` were never read. `apiKeys.list` returns `{ apiKeys }` and `apiKeys.create` `{ apiKey, secret }`, and `apiKeys.revoke` `{ apiKey: { id, revokedAt } }` — what the server sends (they were typed as `keys` / `key` / `revoked`).
- `auditLog.list({ action?, target_type?, limit? })`: the filters the server reads (`action` is a prefix). `cursor`, `since` and `eventType` were ignored.
- `billing.checkout({ plan: 'STARTER' | 'GROWTH' | 'SCALE', email?, name? })` returns `{ subscriptionId, invoiceId, checkoutSessionId, checkoutUrl }`; it sent `planId` / `successUrl` / `cancelUrl`, which the server rejects.
- `billing.invoices` returns `{ data, cursor, hasMore }` (it was typed `{ invoices, nextCursor }`); `billing.checkout` also takes `currency` ('IDR' | 'USD').
- `webhooks.createEndpoint` is typed with the one-time signing `secret` it returns; `shipments.create` with its `draftCreateError`.
- `webhooks.listEvents()` takes no parameters: the server returns the 50 most recent events and ignored `limit` / `cursor` / `type`.
- `ProductCreateInput` and `VariantCreateInput` no longer list `externalRef` / `externalSource`, which the server drops.
- A test checks every hand-written method's route against the API spec (`backend/openapi.json`).

## 0.4.2
- `client.api`: every feature route of the Fulkruma API, one method each (`client.api.<area><Action>(...)`), generated from the backend's own code (scripts/apigen.sh) and signed like every other call.

## 0.4.1
- Package metadata now points at the public mirror repo (github.com/hachimi-cat/fulkruma-node).

## 0.4.0
- Prior release.
