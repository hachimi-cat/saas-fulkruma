---
title: API keys
---

# API keys

An API key is the credential pair (`keyId` + `secret`) you sign Fulkruma requests with. Every workspace can have multiple keys, each with its own name &mdash; one for production, one for staging, one for a back-office script. Fulkruma keys carry the `AKIAFULK*` prefix; there's no test-mode/live-mode split (unlike Plugipay) because the merchant subscription model is single-environment. The Python SDK wraps three endpoints behind `fulkruma.api_keys`. For the HTTP surface see [**API &rarr; API keys**](/docs/api/resources/api-keys), and for how keys are used in the SDK constructor see [**API &rarr; Authentication**](/docs/api/authentication).

## Namespace

```python
fulkruma.api_keys     # ApiKeysResources
```

No `update` &mdash; key metadata is immutable. To "rename" a key, revoke and re-create.

## Methods

### `list`

```python
fulkruma.api_keys.list(*, on_behalf_of: str | None = None) -> dict
```

Returns `{"apiKeys": [...]}`: every key in the workspace, newest first, including revoked ones (filter on `revokedAt` to find active). The `secret` is **never** returned on list &mdash; only a `secretPreview` for recognising a key by eye.

```python
result = fulkruma.api_keys.list()
for k in result["apiKeys"]:
    state = f"revoked {k['revokedAt']}" if k.get("revokedAt") else "active"
    print(f"{k['keyId']} — {k['name']} — {state}")
```

### `create`

```python
fulkruma.api_keys.create(
    *,
    name: str,
    scopes: list[str] | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Mints a new key. `name` is required (1&ndash;120 characters) &mdash; make it specific so you can identify the key later in the dashboard. `scopes` is any of `"read"`, `"write"`, `"admin"`; the server defaults to `["read", "write"]`. The response is `{"apiKey": {...}, "secret": "..."}` &mdash; **this is the only call that returns the secret**. The SDK auto-mints an idempotency key.

```python
result = fulkruma.api_keys.create(name="Production server (jakarta-1)", scopes=["read", "write"])

print(result["apiKey"]["keyId"])   # "AKIAFULK..."
print(result["secret"])            # STORE NOW — never returned again
```

<blockquote class="callout-warn">

**The secret appears once.** Fulkruma shows the secret in the response to `create` and never again. Stash it in your secret manager (AWS Secrets Manager, Vault, env file on a locked-down box) before the function returns. If you lose it, revoke the key and mint a new one.

</blockquote>

### `revoke`

```python
fulkruma.api_keys.revoke(key_id: str, *, on_behalf_of: str | None = None) -> dict
```

Revokes a key and returns `{"apiKey": {"id": ..., "revokedAt": ...}}`; the request carries no body. Subsequent requests signed with that key fail immediately with `401 REVOKED_KEY`. There's no un-revoke; mint a fresh key.

```python
fulkruma.api_keys.revoke("clx4q8k2b0001")
```

Note the argument is the record `id`, **not** the `AKIAFULK*` keyId. They're different &mdash; the record ID is what the management API uses; the keyId is what you sign requests with.

## Types

Each method returns the envelope's `data` as a dict. Key shape:

```python
# api_keys.list()["apiKeys"][0]
{
    "id": "clx4q8k2b0001",       # record ID, used by .revoke()
    "name": "Production server",
    "keyId": "AKIAFULK...",       # the access key
    "secretPreview": "fulksk_a…b3z9",
    "scopes": ["read", "write"],
    "createdAt": "...",
    "lastUsedAt": "..." | None,
    "revokedAt": "..." | None,
    "createdBy": "..." | None,
}
```

`api_keys.create()` returns `{"apiKey": {"id", "name", "keyId", "scopes", "createdAt"}, "secret": "fulksk_..."}`.

`scopes` is recorded on the key and shown in the dashboard; the API does not yet check `read` / `write` / `admin` route by route, so treat any key as full access to its workspace. See [**API &rarr; API keys**](/docs/api/resources/api-keys#scopes).

## Common patterns

**Mint a per-service key and stash it.** Per-service keys are easier to revoke individually than one shared key:

```python
from datetime import datetime

def mint_server_key(fulkruma, service_name: str, secret_manager) -> str:
    result = fulkruma.api_keys.create(
        name=f"Auto-provisioned: {service_name} ({datetime.utcnow().strftime('%Y-%m-%d')})",
    )
    key_id = result["apiKey"]["keyId"]
    secret_manager.put(f"{service_name}/FULKRUMA_KEY_ID", key_id)
    secret_manager.put(f"{service_name}/FULKRUMA_KEY_SECRET", result["secret"])
    return key_id
```

**Audit active keys.** For periodic security reviews:

```python
from datetime import datetime, timezone

def audit_active(fulkruma):
    result = fulkruma.api_keys.list()
    active = [k for k in result["apiKeys"] if not k.get("revokedAt")]
    now = datetime.now(timezone.utc)
    for k in active:
        created = datetime.fromisoformat(k["createdAt"].replace("Z", "+00:00"))
        print(f"{k['keyId']} — {k['name']} — {(now - created).days}d old — last used {k.get('lastUsedAt') or 'never'}")
```

**Rotate a key with overlap.** Mint-then-revoke is safer than revoke-then-mint &mdash; you have a window where both keys work, so you can deploy the new credentials before invalidating the old:

```python
from datetime import datetime

def rotate_key(fulkruma, old_record_id: str, name: str, deploy_fn):
    # 1. Mint the new one
    result = fulkruma.api_keys.create(
        name=f"{name} (rotation {datetime.utcnow().strftime('%Y-%m-%d')})",
    )
    # 2. Deploy new credentials to your services (your CI's job)
    deploy_fn(result["apiKey"]["keyId"], result["secret"])
    # 3. Revoke the old key after confirming the new one works everywhere
    fulkruma.api_keys.revoke(old_record_id)
```

**Translate access keyId &rarr; record ID.** `revoke` needs the record ID:

```python
def revoke_by_access_key(fulkruma, access_key_id: str):
    result = fulkruma.api_keys.list()
    found = next((k for k in result["apiKeys"] if k["keyId"] == access_key_id), None)
    if not found:
        raise ValueError(f"No key found with keyId {access_key_id}")
    fulkruma.api_keys.revoke(found["id"])
```

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `VALIDATION` | Missing or oversized `name`, or a scope outside `read` / `write` / `admin`. |
| `403` | `NO_ACCOUNT` | The credentials resolve to no workspace. |
| `404` | `NOT_FOUND` | Record ID doesn't exist in this workspace (on revoke). |
| `409` | `ALREADY_REVOKED` | Revoking an already-revoked key. |

## Next

- [**API &rarr; Authentication**](/docs/api/authentication) &mdash; the HMAC signing recipe.
- [**API &rarr; API keys**](/docs/api/resources/api-keys) &mdash; HTTP reference.
- [**Audit log**](/docs/sdk/python/resources/audit-log) &mdash; every key-management action shows up here.
