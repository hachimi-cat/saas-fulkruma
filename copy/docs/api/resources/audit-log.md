---
title: Audit log
---

# Audit log

The **audit log** is a read-only chronological record of every workspace-mutating action: who did what, when, against which resource, and (for state-changing actions) what the before/after looked like. It powers the dashboard's audit view and gives you a queryable feed for compliance, debugging, and "who deleted the warehouse?" forensics.

Audit entries are written right after the mutation they record succeeds. The write is best-effort: if it fails, the mutation still stands and the failure is logged on Fulkruma's side, so treat the log as a near-complete record rather than a transactional one.

All requests on this page must be signed &mdash; see [**Authentication**](/docs/api/authentication).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/audit-log` | List audit entries |

Audit entries are read-only; there's no create/update/delete by design.

### List audit entries

```
GET /api/v1/audit-log
```

Returns audit entries for the workspace, newest first. Default limit `100`, max `500`. There is no cursor: to go further back, narrow the filters.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `action` | string | Filter by action prefix. E.g. `action=shipping` matches `shipping.origin_updated`, `shipping.config_updated`. |
| `target_type` | string | Filter by target resource type. E.g. `target_type=Product`. |
| `limit` | integer | Page size. Capped at `500`. |

**Response shape**

```json
{
  "data": {
    "entries": [
      {
        "id": "clx4r1m9d0007qrst3456uvwx",
        "accountId": "acc_01HX...",
        "actorType": "user",
        "actorId": "usr_01HX...",
        "actorEmail": null,
        "action": "product.created",
        "targetType": "Product",
        "targetId": "clx4r1m8z0005mnop1234qrst",
        "ip": null,
        "userAgent": null,
        "before": null,
        "after": { "name": "Espresso Beans 250g", "type": "physical" },
        "metadata": {},
        "createdAt": "2026-05-12T10:42:00.123Z"
      }
    ]
  },
  "error": null,
  "meta": { ... }
}
```

```bash
fulkruma_curl GET '/api/v1/audit-log?action=product&limit=200'
```

## Actions

The audit log uses lower-case, dot-separated action names. Current actions include:

| Action | Resource | Triggered by |
|---|---|---|
| `product.created` | Product | `POST /api/v1/products` |
| `product.updated` | Product | `PATCH /api/v1/products/:id` |
| `product.archived` | Product | `DELETE /api/v1/products/:id` |
| `variant.created` | ProductVariant | `POST /api/v1/products/:id/variants` |
| `variant.updated` | ProductVariant | `PATCH /api/v1/products/:id/variants/:variantId` |
| `variant.archived` | ProductVariant | `DELETE /api/v1/products/:id/variants/:variantId` |
| `delivery.created` | Delivery | `POST /api/v1/deliveries` |
| `delivery.extend` / `delivery.reset-downloads` / `delivery.revoke` | Delivery | `POST /api/v1/deliveries/:id/extend` · `/reset-downloads` · `/revoke` |
| `api_key.created` | ApiKey | `POST /api/v1/api-keys` |
| `api_key.revoked` | ApiKey | `POST /api/v1/api-keys/:id/revoke` |
| `webhook.created` | WebhookEndpoint | `POST /api/v1/webhooks/endpoints` |
| `webhook.updated` | WebhookEndpoint | `PATCH /api/v1/webhooks/endpoints/:id` |
| `webhook.deleted` | WebhookEndpoint | `DELETE /api/v1/webhooks/endpoints/:id` |
| `shipping.origin_updated` | BiteshipConfig | `PATCH /api/v1/shipping/origin` |
| `shipping.config_updated` | BiteshipConfig | `PUT /api/v1/shipping/config` |
| `partner.workspace_provisioned` | PartnerWorkspace | `POST /api/v1/admin/workspaces` |
| `storlaunch.product.synced` | Product | Storlaunch's product-sync webhook (`actorType: "system"`) |

Stock movements are **not** in the audit log &mdash; they have their own append-only [movements](/docs/api/resources/stock#list-stock-movements) feed which is richer (signed delta, reason enum). Warehouse changes are not currently audit-logged; this is on the backlog.

## The audit entry object

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string | no | Fulkruma ID (a cuid). |
| `accountId` | string | no | The workspace. |
| `actorType` | enum | no | `user` for actions taken through the API or dashboard &mdash; an API-key call included; `api_key` for partner workspace provisioning; `system` for background work (e.g. the Storlaunch product sync). |
| `actorId` | string | yes | Who acted: the Huudis user ID for a dashboard session, the workspace ID for an API-key call, `null` for system actors. |
| `actorEmail` | string | yes | The actor's email, when known. |
| `action` | string | no | The action name. |
| `targetType` | string | yes | The resource type (e.g. `Product`, `ApiKey`). |
| `targetId` | string | yes | The resource ID. |
| `before` | object \| null | yes | The relevant fields before the mutation. Only populated for updates and deletes &mdash; creates leave it `null`. |
| `after` | object \| null | yes | The relevant fields after the mutation. Only populated for creates and updates. |
| `ip` | string | yes | Client IP, when available. |
| `userAgent` | string | yes | Client user-agent, when available. |
| `metadata` | object | no | Extra context for the action; `{}` when there is none. |
| `createdAt` | string (ISO 8601 UTC) | no | Entry timestamp. |

## Events

The audit log does **not** emit outbox events. Polling this endpoint is the canonical way to mirror audit data into your own SIEM or compliance store.

## Pattern 2: partner audit visibility

When a partner (Storlaunch, Ripllo) acts on a merchant's workspace via `X-Fulkruma-On-Behalf-Of`, the audit entry is written under the **merchant's** `accountId`, so the merchant's audit log shows partner-driven mutations. The entry doesn't name the partner: like any API-key call it has `actorType: "user"` and the merchant's workspace ID as `actorId`. The exception is `partner.workspace_provisioned`, recorded with `actorType: "api_key"` and the partner's workspace as `actorId`. Partners can read their own audit footprint by listing each merchant's log individually; a cross-merchant rollup is not yet exposed.

## Next

- [**Webhooks**](/docs/api/resources/webhooks) &mdash; the real-time alternative for state changes.
- [**API keys**](/docs/api/resources/api-keys) &mdash; the credentials that show up under `actorType: "api_key"`.
- [**Stock movements**](/docs/api/resources/stock#list-stock-movements) &mdash; the audit feed for inventory.
