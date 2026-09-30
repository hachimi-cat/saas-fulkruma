# Changelog

## 0.2.0
- A call that carries nothing — `Licenses.Revoke`, `APIKeys.Revoke`, `Billing.Cancel`, or any body that marshals to `{}` / `[]` / `null` — now sends no body and signs none; it used to send and sign `{}`, which the server hashed as the empty string (BAD_SIGNATURE). Requests sign exactly the bytes they send.
- `APIKeyCreateInput{Name, Scopes}`: the server requires `name` (and takes `scopes`: read / write / admin); `Description` and `Scope` were never read. `APIKeys.Revoke` reports whether the key is now revoked (it decoded a `revoked` field the server never sends, so it always returned false).
- `AuditLogListParams{Action, TargetType, Limit}`: the filters the server reads. `Cursor`, `Since` and `EventType` were ignored, and there is no `NextCursor`.
- `BillingCheckoutInput{Plan, Email, Name}` (Plan: STARTER / GROWTH / SCALE) and `BillingCheckoutResult{SubscriptionID, InvoiceID, CheckoutSessionID, CheckoutURL}`: what the server takes and returns.
- `Webhooks.ListEvents(ctx)` takes no parameters (the 50 most recent events); `WebhookEventsListParams` is gone.
- Product and variant inputs no longer carry `ExternalRef` / `ExternalSource`, which the server drops.
- A test checks every method's route against the API spec (`backend/openapi.json`).

## 0.1.0
- Initial release. Module path is github.com/hachimi-cat/fulkruma-go.
