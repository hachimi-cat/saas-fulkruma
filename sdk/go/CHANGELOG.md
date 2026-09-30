# Changelog

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

## 0.1.0
- Initial release. Module path is github.com/hachimi-cat/fulkruma-go.
