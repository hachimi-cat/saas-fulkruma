---
title: API authentication
---

# API authentication

Every Fulkruma API request must be signed. We use **HMAC-SHA256 request signing** with a key ID + key secret pair you mint in the dashboard.

This page covers the exact recipe with a worked example. If you're using one of our SDKs ([Node](/docs/sdk), [Python](/docs/sdk), [Go](/docs/sdk)) or the CLI, signing is automatic &mdash; you only need this page if you're integrating directly over HTTP.

## TL;DR

For every request:

1. Compute `bodyHash = sha256(request body in bytes)` &mdash; empty string for `GET`/`DELETE`.
2. Build a string-to-sign: `METHOD\npath\ntimestamp\nbodyHash[\nidempotencyKey]`
3. `signature = HMAC-SHA256(secret, stringToSign)` &mdash; hex-encoded.
4. Send two headers:
   - `Authorization: Fulkruma-HMAC-SHA256 keyId=<id>, scope=*, signature=<hex>`
   - `X-Fulkruma-Timestamp: <epoch seconds>`

## The key pair

Generate an API key in **Settings &rarr; API keys**. You'll get two values:

| Field | Format | Visibility |
|---|---|---|
| Access key ID | `AKIAFULK<random>` | Public (safe to log) |
| Secret | random ~32-char base64-style string | **Secret** &mdash; shown once |

<blockquote class="callout-warn">

**The secret appears only once.** When you create a key, Fulkruma shows the secret in a dialog. If you close it without copying, you have to mint a new key. There's no recovery flow.

</blockquote>

## The signing recipe

### 1. Compute the body hash

Hash the **exact bytes** of the request body you're going to send, using SHA-256:

```
bodyHash = hex(sha256(body))
```

For `GET` and `DELETE` (or any request without a body), use the empty string:

```
bodyHash = hex(sha256("")) = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
```

For `POST`/`PUT`/`PATCH` with a JSON body, hash the **serialized JSON** &mdash; the same bytes you put on the wire. Whitespace matters here: if you `JSON.stringify` with no indentation and send it, hash the no-indentation form; if you pretty-print, hash the pretty-printed form. The server hashes whatever it receives.

<blockquote class="callout-note">

**Most JSON serializers use a canonical compact form by default.** Node's `JSON.stringify`, Python's `json.dumps`, and Go's `json.Marshal` all produce no-whitespace output. Use these defaults and you don't need to think about it.

</blockquote>

### 2. Build the string-to-sign

Five (or four) fields joined by literal `\n` (newline):

```
METHOD\n
path\n
timestamp\n
bodyHash\n
idempotencyKey       (only if you're sending the Idempotency-Key header)
```

| Field | Example |
|---|---|
| `METHOD` | `POST` (uppercase) |
| `path` | `/api/v1/warehouses` &mdash; **include the query string** if any, e.g. `/api/v1/products?archived=false` |
| `timestamp` | `1715526783` (current epoch seconds; must be within 300 seconds of server time) |
| `bodyHash` | hex SHA-256 of the body |
| `idempotencyKey` | the exact value of the `Idempotency-Key` header, if present |

So a `POST /api/v1/shipments` with an idempotency key looks like:

```
POST
/api/v1/shipments
1715526783
b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78
order-2026-05-12-001
```

A `GET /api/v1/warehouses` (no body, no idempotency key):

```
GET
/api/v1/warehouses
1715526783
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

### 3. Compute the signature

```
signature = hex(HMAC-SHA256(secret, stringToSign))
```

Use the **secret**, not the access key ID, as the HMAC key.

### 4. Build the headers

Two headers go on every request:

```
Authorization: Fulkruma-HMAC-SHA256 keyId=AKIAFULK..., scope=*, signature=<hex>
X-Fulkruma-Timestamp: 1715526783
```

The `scope=*` field is for future use (per-key permission scoping). For now, always use `scope=*`.

If your request has a body, also send:

```
Content-Type: application/json
```

If you're sending an idempotency key, add it (the value here must match what's in the string-to-sign):

```
Idempotency-Key: order-2026-05-12-001
```

## Pattern 2: acting on behalf of a merchant

If you're a Forjio partner (Storlaunch is the canonical example) calling Fulkruma for a merchant's workspace, your access key holds the `fulkruma:platform:admin` scope. Add the merchant-routing header:

```
X-Fulkruma-On-Behalf-Of: acc_<merchantWorkspaceId>
```

Fulkruma authenticates the request against the partner's key, then scopes the operation to the named merchant workspace. Audit log entries record both the partner and the on-behalf-of merchant.

This header is **ignored** for non-admin keys &mdash; you can't escalate by adding it to a regular merchant key.

The Storlaunch &rarr; Fulkruma integration uses this exclusively. See `project_forjio_plugipay_storlaunch_integration.md` (internal) for the broader Pattern 2 design.

## Worked example

Sign a `POST /api/v1/warehouses` with these inputs:

- Access key ID: `AKIAFULKEXAMPLE123`
- Secret: `secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Timestamp: `1715526783`
- Body: `{"name":"Main warehouse","city":"Jakarta"}`

Step 1: body hash

```
sha256('{"name":"Main warehouse","city":"Jakarta"}')
  = "8d2c5b3b3..."
```

Step 2: string-to-sign

```
POST
/api/v1/warehouses
1715526783
8d2c5b3b3...
```

Step 3: signature (using the secret as the HMAC key)

```
HMAC-SHA256("secret_xxx...", stringToSign)
  = "7c4f1a2d3b4c5d6e7f8a9b0c1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5e6"
```

Step 4: send

```http
POST /api/v1/warehouses HTTP/1.1
Host: fulkruma.com
Authorization: Fulkruma-HMAC-SHA256 keyId=AKIAFULKEXAMPLE123, scope=*, signature=7c4f1a2d3b4c5d6e7f8a9b0c1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5e6
X-Fulkruma-Timestamp: 1715526783
Content-Type: application/json

{"name":"Main warehouse","city":"Jakarta"}
```

## A complete `curl` example

For copy-paste, here's a shell function that signs and sends a Fulkruma request:

```bash
fulkruma_curl() {
  local METHOD="$1"
  local PATH_QS="$2"
  local BODY="${3:-}"

  local TS=$(date +%s)
  local BODY_HASH=$(printf '%s' "$BODY" | openssl dgst -sha256 | awk '{print $2}')
  local STRING_TO_SIGN="${METHOD}
${PATH_QS}
${TS}
${BODY_HASH}"

  local SIG=$(printf '%s' "$STRING_TO_SIGN" | \
    openssl dgst -sha256 -hmac "$FULKRUMA_KEY_SECRET" | \
    awk '{print $2}')

  curl -sS -X "$METHOD" "https://fulkruma.com$PATH_QS" \
    -H "Authorization: Fulkruma-HMAC-SHA256 keyId=$FULKRUMA_KEY_ID, scope=*, signature=$SIG" \
    -H "X-Fulkruma-Timestamp: $TS" \
    ${BODY:+-H "Content-Type: application/json"} \
    ${BODY:+-d "$BODY"}
}

# Usage:
export FULKRUMA_KEY_ID=AKIAFULK...
export FULKRUMA_KEY_SECRET=...

fulkruma_curl GET '/api/v1/warehouses'
fulkruma_curl POST '/api/v1/warehouses' '{"name":"Main warehouse","city":"Jakarta"}'
```

For more complex flows or production code, use one of our [**SDKs**](/docs/sdk) &mdash; they handle this automatically.

## Reference: signing in each SDK language

For comparison with your own implementation, here's what the SDKs do.

**Node.js:**

```js
const crypto = require('node:crypto');

function sign(secret, method, path, timestamp, body, idempotencyKey) {
  const bodyHash = crypto.createHash('sha256').update(body || '').digest('hex');
  const parts = [method.toUpperCase(), path, timestamp, bodyHash];
  if (idempotencyKey) parts.push(idempotencyKey);
  const stringToSign = parts.join('\n');
  return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
}
```

**Python:**

```python
import hashlib, hmac

def sign(secret, method, path, timestamp, body, idempotency_key=None):
    body_hash = hashlib.sha256((body or '').encode()).hexdigest()
    parts = [method.upper(), path, str(timestamp), body_hash]
    if idempotency_key:
        parts.append(idempotency_key)
    string_to_sign = '\n'.join(parts)
    return hmac.new(secret.encode(), string_to_sign.encode(), hashlib.sha256).hexdigest()
```

## Timestamp tolerance

The server rejects requests where `X-Fulkruma-Timestamp` is more than **300 seconds** (5 minutes) off server time. This blocks replay attacks: a captured signature is useless 5 minutes later.

If you see `401 invalid_timestamp`, make sure your system clock is correct.

## Common errors

### `401 invalid_signature`

The signature didn't match what the server computed. Causes (in order of likelihood):

- **Wrong secret** &mdash; you copied the access key ID as the secret, or partial copy.
- **Wrong string-to-sign format** &mdash; extra whitespace, wrong field order, missing newline before idempotency key, sending an idempotency key in the header but not in the signature (or vice versa).
- **Body bytes don't match** &mdash; you hashed pretty-printed JSON but sent compact, or vice versa.
- **Path with vs without query string** &mdash; we sign the path **including** the query string.

### `401 invalid_key`

The access key ID doesn't exist, has been revoked, or is from a different workspace.

### `403 insufficient_scope`

The key exists but doesn't have the scope to perform this operation. Most commonly, you tried to pass `X-Fulkruma-On-Behalf-Of` with a non-admin key.

### `403 NO_ACCOUNT`

The token authenticated but is missing the `accountId` claim. Rare; usually means a misconfigured platform-admin token. Re-mint the key.

## Webhook signatures vs API signatures

This page covers **outbound API requests** (your code &rarr; Fulkruma). Fulkruma also signs **inbound webhooks** (Fulkruma &rarr; your endpoint) with a different scheme &mdash; see the dashboard's Webhooks page for the signature recipe.

## Next

- [**API overview**](/docs/api) &mdash; the resource catalog.
- [**SDKs**](/docs/sdk) &mdash; if you'd rather not implement signing yourself.
- [**Authentication overview**](/docs/auth/overview) &mdash; the merchant-facing OIDC flow (different from this).
