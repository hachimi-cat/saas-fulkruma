---
title: API keys
---

# API keys

The **API keys** resource lets you mint, list, and revoke HMAC credentials programmatically &mdash; the same keys you'd otherwise create from **Dashboard &rarr; Settings &rarr; API keys**.

This page is about **managing** keys. For the signing recipe, see [**Authentication**](/docs/api/authentication).

<blockquote class="callout-warn">

**The secret is shown exactly once, on creation.** Fulkruma stores only a one-way SHA-256 hash of the secret. If you lose it, the only recovery is to revoke the key and mint a new one &mdash; there is no fetch-secret endpoint and there never will be.

</blockquote>

## Key format

| Component | Format | Visibility |
|---|---|---|
| Access key ID | `AKIAFULK<random hex>` &mdash; 24 chars total | Public. Safe to log; appears in audit-log entries. |
| Secret | `fulksk_<random>` &mdash; ~50 chars base64url | Secret. Shown once on `201 Created`; only a hash is stored. |
| Secret preview | First 8 + `…` + last 4 of the secret | Returned on every list/retrieve. Safe to display in the dashboard for human key recognition. |

Fulkruma uses a **single environment** &mdash; no test/live split. The first integration is against staging at `staging.fulkruma.com`; production keys are minted separately. Mixing staging and production keys is currently up to operational hygiene; the test/live prefix split lands later.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/api-keys` | List keys in the workspace |
| `POST` | `/api/v1/api-keys` | Create a key |
| `POST` | `/api/v1/api-keys/:id/revoke` | Revoke a key |

There's no `DELETE /:id` &mdash; revocation is a state flip, not a row delete. Revoked rows stay queryable for audit.

### List keys

```
GET /api/v1/api-keys
```

Returns every key in the workspace, newest first. Includes both active and revoked rows; sort/filter client-side.

**Response shape**

```json
{
  "data": {
    "apiKeys": [
      {
        "id": "akey_01HXAB7K3M9N2P5QRS8TVWXY3Z",
        "name": "Production server",
        "keyId": "AKIAFULK1234567890ABCDEF",
        "secretPreview": "fulksk_a…b3z9",
        "scopes": ["read", "write"],
        "createdAt": "2026-05-12T10:42:00.123Z",
        "lastUsedAt": "2026-05-12T11:01:00.123Z",
        "revokedAt": null,
        "createdBy": "usr_01HX..."
      }
    ]
  },
  "error": null,
  "meta": { ... }
}
```

```bash
fulkruma_curl GET '/api/v1/api-keys'
```

### Create a key

```
POST /api/v1/api-keys
```

Mints a new key under the calling workspace and returns the plaintext secret. The secret is **not** retrievable later.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string (1&ndash;120) | yes | Human label. Use something specific (`Production server`, `CI &mdash; GitHub Actions`). |
| `scopes` | string[] | no | Subset of `["read", "write", "admin"]`. Default `["read", "write"]`. `admin` is required for `X-Fulkruma-On-Behalf-Of` partner calls. |

**Response** &mdash; `201 Created`. The response includes the [API key object](#the-api-key-object) **plus** a top-level `secret` field with the plaintext.

```json
{
  "data": {
    "apiKey": {
      "id": "akey_01HX...",
      "name": "Production server",
      "keyId": "AKIAFULK1234567890ABCDEF",
      "scopes": ["read", "write"],
      "createdAt": "2026-05-12T10:42:00.123Z"
    },
    "secret": "fulksk_AbCdEf1234567890XyZaBcDeF1234567890aBcDeF12"
  },
  "error": null,
  "meta": { ... }
}
```

The top-level `secret` field is present **only** on this `201` response; subsequent calls never include it.

<blockquote class="callout-warn">

**Capture `secret` synchronously.** Pipe it straight to your secrets manager or environment file. Don't log it; don't keep it in shell history.

</blockquote>

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `400` | `VALIDATION` | Missing/oversized `name`, or `scopes` outside the allowed set. |
| `403` | `NO_ACCOUNT` | Token has no `accountId`. |

```bash
fulkruma_curl POST '/api/v1/api-keys' \
  '{"name":"Production server","scopes":["read","write"]}'
```

### Revoke a key

```
POST /api/v1/api-keys/:id/revoke
```

Revokes a key immediately. Any request signed with it starts returning `401 invalid_key` within a few seconds &mdash; no grace period.

**Errors**

| Status | `error.code` | When |
|---|---|---|
| `404` | `NOT_FOUND` | No such key in this workspace. |
| `409` | `ALREADY_REVOKED` | The key has already been revoked. |

```bash
fulkruma_curl POST '/api/v1/api-keys/akey_01HX.../revoke' ''
```

<blockquote class="callout-warn">

**Revocation is irreversible** and propagates within seconds. Always rotate before revoking &mdash; never the other way round. See [Programmatic rotation](#programmatic-rotation).

</blockquote>

## The API key object

| Field | Type | Notes |
|---|---|---|
| `id` | string (`akey_…`) | Internal ID. Use this in URLs. |
| `name` | string | Whatever you passed on create. |
| `keyId` | string | Public access key ID (`AKIAFULK*`). Goes in the `Authorization` header. Safe to log. |
| `secretPreview` | string | First 8 + last 4 of the secret. Safe to display. |
| `scopes` | string[] | Subset of `read`, `write`, `admin`. |
| `createdAt` | string (ISO 8601 UTC) | Creation timestamp. |
| `lastUsedAt` | string \| null | Most recent signed request. Updates within seconds. `null` until first use. |
| `revokedAt` | string \| null | Revocation timestamp. `null` for active keys. |
| `createdBy` | string \| null | User ID (`usr_…`) of the creator. |

## Scopes

Fulkruma's scope model is intentionally simple in v1. Three values, allowed in combination:

| Scope | What it grants |
|---|---|
| `read` | Every `GET` endpoint in the workspace. |
| `write` | All `POST`/`PATCH`/`DELETE` endpoints. |
| `admin` | Required for `X-Fulkruma-On-Behalf-Of` &mdash; Pattern 2 partner calls. Partner-only; merchants don't usually mint admin keys. |

A `403 INSUFFICIENT_SCOPE` from any endpoint means the calling key lacks the necessary scope.

## Programmatic rotation

Always: mint &rarr; verify &rarr; cut over &rarr; revoke. Never the reverse.

```js
// 1. Mint a replacement with the same scopes.
const created = await fk.apiKeys.create({
  name: `Production server (rotated ${new Date().toISOString().slice(0, 10)})`,
  scopes: ['read', 'write'],
});

// 2. Push secret into your secrets manager. Wait for consumers
//    to reload and confirm they sign one request successfully.
await secrets.set('FULKRUMA_KEY_ID', created.apiKey.keyId);
await secrets.set('FULKRUMA_KEY_SECRET', created.secret);
await waitForConsumersToReload();

// 3. Once lastUsedAt advances on the new key (and the old one has
//    gone quiet), revoke the old one.
await fk.apiKeys.revoke(process.env.OLD_KEY_INTERNAL_ID);
```

`lastUsedAt` is the simplest verification signal &mdash; if it advances on the new key within 60 seconds of cutover, you're safe to revoke. If not, the old key is still in use; investigate first. Schedule rotation as a quarterly cron.

## Events

The API keys resource does **not** broadcast on the event stream &mdash; we don't want webhook subscribers enumerating credential lifecycle. Key creation and revocation **do** show up in the [**audit log**](/docs/api/resources/audit-log) under actions `api_key.created` and `api_key.revoked`. Capture a signal in your own systems at the point you call `apiKeys.create` / `apiKeys.revoke`.

## Next

- [**Authentication**](/docs/api/authentication) &mdash; using the secret to sign requests.
- [**Audit log**](/docs/api/resources/audit-log) &mdash; who minted or revoked which key, when.
