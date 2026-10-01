# Changelog

## Unreleased
- `client.api.deliveries_download(id_)` records a download of a digital delivery (POST /deliveries/{id}/download): counted against `maxDownloads`; 409 `DOWNLOAD_LIMIT` when used up, 410 `EXPIRED` after expiry.
- More event types arrive at your endpoints: `fulkruma.product.updated.v1`, `fulkruma.product.archived.v1`, `fulkruma.variant.created.v1`, `fulkruma.variant.archived.v1`, `fulkruma.delivery.downloaded.v1`, `fulkruma.delivery.expired.v1`, `fulkruma.license.activated.v1`, `fulkruma.license.deactivated.v1`.

## 0.4.0
- Three more event types arrive at your endpoints (and through `verify_webhook` like any other): `fulkruma.stock.low.v1` (a level falls below its variant's `lowStockThreshold`, once per crossing), `fulkruma.warehouse.created.v1` and `fulkruma.webhook_endpoint.disabled.v1` (Fulkruma switched off one of your other endpoints that kept failing).
- `client.api`: regenerated. A GET by id next to a list of the same name is `get_…`: `webhooks_get_events(id)` and `shipping_get_shipments(id)`. The old names `webhooks_events_2` and `shipping_shipments_2` still work (deprecated). `shipping_track(waybill_id, courier=...)` requires `courier`, which the server always did.

## 0.3.0
- Fulkruma now delivers webhooks to the endpoints you register (it never did before — the delivery log was always empty). `webhooks.list_events` reads that log: one row per event per endpoint with its `status` (`pending` / `sent` / `failed`), `attempts`, `nextRetryAt`, `lastError` and every attempt made (`deliveryAttempts`).
- `webhooks.list_events(limit=, cursor=, type=, status=, endpoint_id=)` filters and pages (the response carries `nextCursor`); `webhooks.get_event(id)` reads one delivery; `webhooks.retry_event(id)` queues another attempt now.
- `verify_webhook` is tested against a signature the server made (a vector shared with the backend and the Node and Go SDKs).
- `client.api`: regenerated — `webhooks_events` takes the filters, `webhooks_events_2(id)` and `webhooks_events_retry(id)` are new.

## 0.2.0
- Requests sign exactly the bytes they send, and send compact UTF-8 JSON (non-ASCII text as itself, not `\u` escapes). A call that carries nothing — `licenses.revoke`, `api_keys.revoke`, `billing.cancel`, or an empty dict / list body — now sends no body and signs none; it used to send and sign `{}`, which the server hashed as the empty string (BAD_SIGNATURE).
- `api_keys.create(name=..., scopes=None)`: the server requires `name` (and takes `scopes`: read / write / admin). It took an optional dict and sent `{}` when none was given.
- `audit_log.list(action=, target_type=, limit=)`: the filters the server reads (`action` is a prefix). `cursor`, `since` and `event_type` were ignored.
- `webhooks.list_events()` takes no filters: the server returns the 50 most recent events.
- `billing.checkout(body)` documents the body the server takes: `{"plan": "STARTER" | "GROWTH" | "SCALE", "email"?, "name"?}`.
- A test checks every hand-written method's route against the API spec (`backend/openapi.json`).

## 0.1.1
- `client.api`: every feature route of the Fulkruma API, one method each (`client.api.<area>_<action>(...)`), generated from the backend's own code (scripts/apigen.sh) and signed like every other call.

## 0.1.0
- Initial tracked release.
