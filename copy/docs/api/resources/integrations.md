---
title: Integrations
---

# Integrations

The **integrations** resource exposes a single endpoint &mdash; a runtime health snapshot of the systems Fulkruma talks to. It's the same data the dashboard's **Integrations** card grid reads, with no caching: every call hits the underlying tables.

This endpoint exists because the merchant dashboard kept lying about "partial" / "connected" status. Instead of guessing, the API aggregates concrete signals: is a secret set, is a key configured, when did the most recent event arrive, how many synced rows exist.

All requests on this page must be signed &mdash; see [**Authentication**](/docs/api/authentication).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/integrations/status` | Aggregated runtime status of every connected system |

### Read integrations status

```
GET /api/v1/integrations/status
```

Returns one stanza per integration. Fields are populated only when relevant &mdash; an unconfigured integration returns `null` (Biteship) or a stanza with `configured: false`-style flags (Plugipay, Storlaunch).

**Response shape**

```json
{
  "data": {
    "huudis": { "connected": true },
    "biteship": {
      "apiKeyConfigured": true,
      "active": true,
      "enabledCouriers": ["jne", "sicepat", "anteraja"]
    },
    "plugipay": {
      "webhookSecretSet": true,
      "partnerKey": { "configured": true },
      "lastEventAt": "2026-05-12T10:42:00.123Z",
      "eventCount30d": 0
    },
    "storlaunch": {
      "webhookSecretSet": true,
      "partnerKey": { "configured": true },
      "mirroredProductCount": 42,
      "lastSyncAt": "2026-05-12T09:13:00.000Z"
    }
  },
  "error": null,
  "meta": { ... }
}
```

```bash
fulkruma_curl GET '/api/v1/integrations/status'
```

## Stanzas

### `huudis`

| Field | Type | Description |
|---|---|---|
| `connected` | boolean | Always `true` on a successful auth &mdash; the request itself proves the OIDC session works. |

### `biteship`

`null` if the workspace has no `BiteshipConfig` row yet.

| Field | Type | Description |
|---|---|---|
| `apiKeyConfigured` | boolean | Whether a BYO Biteship API key is on file (not the value, just presence). |
| `active` | boolean | The master kill-switch on the config. |
| `enabledCouriers` | string[] | The merchant's whitelisted courier codes. |

### `plugipay`

| Field | Type | Description |
|---|---|---|
| `webhookSecretSet` | boolean | Whether `PLUGIPAY_WEBHOOK_SECRET` is set in Fulkruma's env. Operator-managed. |
| `partnerKey.configured` | boolean | Whether the Fulkruma-as-partner key (for calling Plugipay) is on file. |
| `lastEventAt` | string \| null | Timestamp of the most recent inbound Plugipay event Fulkruma processed. `null` if no events ever received. |
| `eventCount30d` | integer | Reserved &mdash; currently always `0`. Will be populated once Plugipay events get an indexable type column. |

### `storlaunch`

| Field | Type | Description |
|---|---|---|
| `webhookSecretSet` | boolean | Whether `STORLAUNCH_WEBHOOK_SECRET` is set in Fulkruma's env. |
| `partnerKey.configured` | boolean | Whether a Storlaunch-partner API key has been minted in Fulkruma (a row in `ApiKey` with `partner=storlaunch` and `revokedAt=null`). |
| `mirroredProductCount` | integer | Count of products in this workspace with `externalSource=storlaunch`. |
| `lastSyncAt` | string \| null | The most recent `updatedAt` on any Storlaunch-sourced product. `null` if no products ever synced. |

## Events

The integrations resource does **not** emit events. It's a read-only health snapshot.

## Pattern 2 notes

When called with `X-Fulkruma-On-Behalf-Of` by a partner, this endpoint returns the merchant's view of the integration health &mdash; including the partner's own connection from the merchant's perspective. Partners can use this to surface "your Storlaunch sync is healthy" status inside their own dashboard.

## Next

- [**Shipping**](/docs/api/resources/shipping) &mdash; configure the Biteship integration.
- [**Billing**](/docs/api/resources/billing) &mdash; Fulkruma's own Plugipay subscription.
- [**Webhooks**](/docs/api/resources/webhooks) &mdash; register your own outbound endpoints.
