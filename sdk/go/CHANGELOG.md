# Changelog

## 0.4.0
- Three more event types arrive at your endpoints (and through `VerifyWebhook` like any other): `fulkruma.stock.low.v1` (a level falls below its variant's `lowStockThreshold`, once per crossing), `fulkruma.warehouse.created.v1` and `fulkruma.webhook_endpoint.disabled.v1` (Fulkruma switched off one of your other endpoints that kept failing).
- `Client.API`: regenerated. A GET by id next to a list of the same name is `Get…`: `WebhooksGetEvents` and `ShippingGetShipments`. The old names `WebhooksEvents2` and `ShippingShipments2` still work (marked `Deprecated:`). `ShippingTrackArgs.Courier` is documented as required, as the server always required it.

## 0.3.0
- Fulkruma now delivers webhooks to the endpoints you register (it never did before — the delivery log was always empty). `Webhooks.ListEvents` reads that log as typed `WebhookDelivery` rows: one per event per endpoint with its `Status` (`pending` / `sent` / `failed`), `Attempts`, `NextRetryAt`, `LastError` and every attempt made (`DeliveryAttempts`).
- **Breaking:** `Webhooks.ListEvents(ctx, WebhookEventsListParams{Limit, Cursor, Type, Status, EndpointID})` filters and pages (`NextCursor`); `WebhookEventsListResult.Events` is `[]WebhookDelivery` (it was `[]map[string]any`). `Webhooks.GetEvent(ctx, id)` and `Webhooks.RetryEvent(ctx, id)` are new.
- `VerifyWebhook` is tested against a signature the server made (a vector shared with the backend and the Node and Python SDKs).
- `Client.API`: regenerated — `WebhooksEvents` takes the filters; `WebhooksEvents2` and `WebhooksEventsRetry` are new.

## 0.2.0
- A call that carries nothing — `Licenses.Revoke`, `APIKeys.Revoke`, `Billing.Cancel`, or any body that marshals to `{}` / `[]` / `null` — now sends no body and signs none; it used to send and sign `{}`, which the server hashed as the empty string (BAD_SIGNATURE). Requests sign exactly the bytes they send.
- `APIKeyCreateInput{Name, Scopes}`: the server requires `name` (and takes `scopes`: read / write / admin); `Description` and `Scope` were never read. `APIKeys.List` decodes the server's `apiKeys` (it read `keys`, so it always came back empty); `APIKeys.Create` returns an `*APIKeyCreated{APIKey, Secret}` (it read `key`, so the one-time secret was lost); `APIKeys.Revoke` reports whether the key is now revoked (it read a `revoked` field the server never sends, so it always returned false).
- `AuditLogListParams{Action, TargetType, Limit}`: the filters the server reads. `Cursor`, `Since` and `EventType` were ignored, and there is no `NextCursor`.
- `BillingCheckoutInput{Plan, Email, Name}` (Plan: STARTER / GROWTH / SCALE) and `BillingCheckoutResult{SubscriptionID, InvoiceID, CheckoutSessionID, CheckoutURL}`: what the server takes and returns.
- `BillingInvoicesResult{Data, Cursor, HasMore}`: what the server sends (it decoded `invoices` / `nextCursor`, so every page came back empty); `BillingCheckoutInput` also takes `Currency` (IDR or USD).
- `Webhooks.CreateEndpoint` returns `*WebhookEndpointCreated{Endpoint, Secret}`: it returned only the endpoint, so the one-time signing secret was lost.
- `Webhooks.ListEvents(ctx)` takes no parameters (the 50 most recent events); `WebhookEventsListParams` is gone.
- Product and variant inputs no longer carry `ExternalRef` / `ExternalSource`, which the server drops.
- A test checks every method's route against the API spec (`backend/openapi.json`).
- `Client.API`: every feature route of the API, one method each, generated
  from the API spec (`api_generated.go`) and signed like every other call.

## 0.1.0
- Initial release. Module path is github.com/hachimi-cat/fulkruma-go.
