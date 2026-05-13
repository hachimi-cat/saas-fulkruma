---
title: API keys
---

# API keys

An API key is the credential pair (`keyId` + `secret`) you sign Fulkruma requests with. Every workspace can have multiple keys with different descriptions and scopes &mdash; one for production, one for staging, one for a back-office script. Fulkruma keys carry the `AKIAFULK*` prefix; there's no test-mode/live-mode split (unlike Plugipay) because the merchant subscription model is single-environment. The Python SDK wraps three endpoints behind `fulkruma.api_keys`. For the HTTP surface see [**API &rarr; API keys**](/docs/api/resources/api-keys), and for how keys are used in the SDK constructor see [**API &rarr; Authentication**](/docs/api/authentication).

## Namespace

```python
fulkruma.api_keys     # ApiKeysResources
```

No `update` &mdash; key metadata is immutable. To "rename" a key, revoke and re-create. **Using this namespace requires an admin-level key** (typically the bootstrap key the workspace was provisioned with).

## Methods

### `list`

```python
fulkruma.api_keys.list(*, on_behalf_of: str | None = None) -> dict
```

Returns every key in the workspace, including revoked ones (filter on `revokedAt` to find active). The `secret` field is **never** returned on list.

```python
result = fulkruma.api_keys.list()
for k in result["keys"]:
    state = f"revoked {k['revokedAt']}" if k.get("revokedAt") else "active"
    print(f"{k['keyId']} — {k.get('description') or '(no description)'} — {state}")
```

### `create`

```python
fulkruma.api_keys.create(
    body: dict | None = None,
    *,
    on_behalf_of: str | None = None,
) -> dict
```

Mints a new key. Pass a human-readable `description` (so you can identify it later in the dashboard) and optionally a `scope` to narrow what it can do. The returned object includes the `secret` &mdash; **this is the only call that returns it**. The SDK auto-mints an idempotency key.

```python
result = fulkruma.api_keys.create({
    "description": "Production server (jakarta-1)",
    "scope": "fulkruma:shipment:* fulkruma:stock:read",
})

k = result["key"]
print(k["keyId"])      # "AKIAFULK..."
print(k["secret"])     # STORE NOW — never returned again
```

<blockquote class="callout-warn">

**The secret appears once.** Fulkruma shows the secret in the response to `create` and never again. Stash it in your secret manager (AWS Secrets Manager, Vault, env file on a locked-down box) before the function returns. If you lose it, revoke the key and mint a new one.

</blockquote>

### `revoke`

```python
fulkruma.api_keys.revoke(key_id: str, *, on_behalf_of: str | None = None) -> dict
```

Revokes a key. Subsequent requests signed with that key fail immediately with `invalid_signature` / `key_revoked`. There's no un-revoke; mint a fresh key.

```python
fulkruma.api_keys.revoke("apk_01HX...")
```

Note the argument is the `apk_*` record ID, **not** the `AKIAFULK*` keyId. They're different &mdash; the record ID is what the management API uses; the keyId is what you sign requests with.

## Types

Each method returns a dict with the API envelope. Key shape:

```python
# api_keys.create()["key"]
{
    "id": "apk_...",              # used by .revoke()
    "accountId": "acc_...",
    "keyId": "AKIAFULK...",       # the access key
    "description": "..." | None,
    "scope": "fulkruma:shipment:*",   # space-separated permission list
    "secret": "...",              # only on create
    "createdAt": "...",
    "revokedAt": "..." | None
}
```

For the full scope vocabulary, see [**API &rarr; API keys**](/docs/api/resources/api-keys) and [**API &rarr; Authentication**](/docs/api/authentication).

## Common patterns

**Mint a per-service key and stash it.** Per-service keys are easier to revoke individually than one shared admin key:

```python
import os
from datetime import datetime

def mint_server_key(fulkruma, service_name: str, secret_manager) -> str:
    result = fulkruma.api_keys.create({
        "description": f"Auto-provisioned: {service_name} ({datetime.utcnow().strftime('%Y-%m-%d')})",
        "scope": "fulkruma:shipment:* fulkruma:stock:read fulkruma:webhook:read",
    })
    k = result["key"]
    secret_manager.put(f"{service_name}/FULKRUMA_KEY_ID", k["keyId"])
    secret_manager.put(f"{service_name}/FULKRUMA_KEY_SECRET", k["secret"])
    return k["keyId"]
```

**Audit active keys.** For periodic security reviews:

```python
from datetime import datetime, timezone

def audit_active(fulkruma):
    result = fulkruma.api_keys.list()
    active = [k for k in result["keys"] if not k.get("revokedAt")]
    now = datetime.now(timezone.utc)
    for k in active:
        age_days = (now - datetime.fromisoformat(k["createdAt"])).days
        print(f"{k['keyId']} — {k.get('description') or '(none)'} — {age_days}d old")
```

**Rotate a key with overlap.** Mint-then-revoke is safer than revoke-then-mint &mdash; you have a window where both keys work, so you can deploy the new credentials before invalidating the old:

```python
from datetime import datetime

def rotate_key(fulkruma, old_record_id: str, description: str, deploy_fn):
    # 1. Mint the new one
    result = fulkruma.api_keys.create({
        "description": f"{description} (rotation {datetime.utcnow().strftime('%Y-%m-%d')})",
        "scope": "*",
    })
    k = result["key"]
    # 2. Deploy new credentials to your services (your CI's job)
    deploy_fn(k["keyId"], k["secret"])
    # 3. Revoke the old key after confirming the new one works everywhere
    fulkruma.api_keys.revoke(old_record_id)
```

**Translate access keyId &rarr; record ID.** `revoke` needs the record ID (`apk_*`):

```python
def revoke_by_access_key(fulkruma, access_key_id: str):
    result = fulkruma.api_keys.list()
    found = next((k for k in result["keys"] if k["keyId"] == access_key_id), None)
    if not found:
        raise ValueError(f"No key found with keyId {access_key_id}")
    fulkruma.api_keys.revoke(found["id"])
```

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Bad `scope` value, description too long. |
| `403` | `insufficient_scope` | Calling key lacks `fulkruma:apikey:write`. |
| `404` | `not_found` | Record ID doesn't exist (on revoke). |
| `409` | `conflict` | Revoking an already-revoked key. |

## Next

- [**API &rarr; Authentication**](/docs/api/authentication) &mdash; the HMAC signing recipe.
- [**API &rarr; API keys**](/docs/api/resources/api-keys) &mdash; HTTP reference.
- [**Audit log**](/docs/sdk/python/resources/audit-log) &mdash; every key-management action shows up here.
