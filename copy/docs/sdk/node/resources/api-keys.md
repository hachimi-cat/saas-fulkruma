---
title: API keys
---

# API keys

An **API key** is the credential pair (`keyId` + `secret`) you sign Fulkruma requests with. Every workspace can have multiple keys, each with its own name &mdash; one for production, one for staging, one for a back-office script. Fulkruma keys carry the `AKIAFULK*` prefix; there's no test-mode/live-mode split (unlike Plugipay) because the merchant subscription model is single-environment. This page covers the `fulkruma.apiKeys` namespace; for the underlying HTTP surface see [API: API keys](/docs/api/resources/api-keys), and for how keys are used in the SDK constructor see [API: Authentication](/docs/api/authentication).

## Namespace

`fulkruma.apiKeys` &mdash; every method:

```ts
fulkruma.apiKeys.list()
fulkruma.apiKeys.create({ name, scopes })
fulkruma.apiKeys.revoke(id)
```

No `update` &mdash; key metadata is immutable. To "rename" a key, revoke and re-create.

## Methods

### `apiKeys.list`

**Signature.** `fulkruma.apiKeys.list(): Promise<{ apiKeys: ApiKey[] }>`

Returns every key in the workspace, newest first, including revoked ones (filter on `revokedAt` to find active). The `secret` is **never** returned on list &mdash; only a `secretPreview` for recognising a key by eye.

```ts
const { apiKeys } = await fulkruma.apiKeys.list();
for (const k of apiKeys) {
  const state = k.revokedAt ? `revoked ${k.revokedAt}` : 'active';
  console.log(`${k.keyId} — ${k.name} — ${state}`);
}
```

### `apiKeys.create`

**Signature.** `fulkruma.apiKeys.create(input: { name: string; scopes?: Array<'read' | 'write' | 'admin'> }): Promise<{ apiKey: ApiKey; secret: string }>`

Mints a new key. `name` is required (1&ndash;120 characters) &mdash; make it specific so you can identify the key later in the dashboard. `scopes` defaults to `['read', 'write']`. The response carries the plaintext `secret` next to the key &mdash; **this is the only call that ever returns it**. The SDK auto-mints an `Idempotency-Key`.

```ts
const { apiKey, secret } = await fulkruma.apiKeys.create({
  name: 'Production server (jakarta-1)',
  scopes: ['read', 'write'],
});

console.log(apiKey.keyId);   // → 'AKIAFULK...'
console.log(secret);         // STORE NOW — never returned again
```

<blockquote class="callout-warn">

**The secret appears once.** Fulkruma shows the secret in the response to `create` and never again. Stash it in your secret manager (AWS Secrets Manager, Vault, env file on a locked-down box, whatever you use) before the function returns. If you lose it, revoke the key and mint a new one.

</blockquote>

### `apiKeys.revoke`

**Signature.** `fulkruma.apiKeys.revoke(id): Promise<{ apiKey: { id: string; revokedAt: string } }>`

Revokes a key; the request carries no body. Subsequent requests signed with that key fail immediately with `401 REVOKED_KEY`. There's no un-revoke; mint a fresh key if you need to restore access.

```ts
const { apiKey } = await fulkruma.apiKeys.revoke('clx4q8k2b0001');
console.log(apiKey.revokedAt);
```

Note the argument is the record `id` (returned on `list`/`create`), **not** the `AKIAFULK*` keyId. They're different &mdash; the record ID is what the management API uses; the keyId is what you sign requests with.

## Types

```ts
interface ApiKey {
  id: string;                  // record ID — used by .revoke()
  name: string;
  keyId: string;               // 'AKIAFULK...' — the access key
  secretPreview?: string;      // first 8 + last 4 of the secret (list only)
  scopes: Array<'read' | 'write' | 'admin'>;
  createdAt: string;
  lastUsedAt?: string | null;  // list only
  revokedAt?: string | null;   // list only
  createdBy?: string | null;   // list only
}
```

`scopes` is recorded on the key and shown in the dashboard; the API does not yet check `read` / `write` / `admin` route by route, so treat any key as full access to its workspace. See [API: API keys](/docs/api/resources/api-keys#scopes).

## Common patterns

### Mint a per-service key and stash it

Per-service keys are easier to revoke individually than one shared key:

```ts
async function mintServerKey(serviceName: string) {
  const { apiKey, secret } = await fulkruma.apiKeys.create({
    name: `Auto-provisioned: ${serviceName} (${new Date().toISOString().slice(0, 10)})`,
  });

  await secretManager.put(`${serviceName}/FULKRUMA_KEY_ID`, apiKey.keyId);
  await secretManager.put(`${serviceName}/FULKRUMA_KEY_SECRET`, secret);

  console.log(`Provisioned ${apiKey.keyId} for ${serviceName}`);
  return apiKey.keyId;
}
```

### Audit active keys

For periodic security reviews:

```ts
async function auditActiveKeys() {
  const { apiKeys } = await fulkruma.apiKeys.list();
  const active = apiKeys.filter((k) => !k.revokedAt);
  console.log(`${active.length} active keys:`);
  for (const k of active) {
    const ageDays = Math.floor((Date.now() - Date.parse(k.createdAt)) / 86_400_000);
    console.log(`  ${k.keyId} — ${k.name} — ${ageDays}d old — last used ${k.lastUsedAt ?? 'never'}`);
  }
}
```

### Rotate a key with overlap

Mint-then-revoke is safer than revoke-then-mint &mdash; you have a window where both keys work, so you can deploy the new credentials before invalidating the old:

```ts
async function rotateKey(oldRecordId: string, name: string) {
  // 1. Mint the new one
  const { apiKey, secret } = await fulkruma.apiKeys.create({
    name: `${name} (rotation ${new Date().toISOString().slice(0, 10)})`,
  });

  // 2. Deploy the new credentials to your services. (Your CI's job.)
  await deployNewKey(apiKey.keyId, secret);

  // 3. After confirming the new key works everywhere, revoke the old one
  await fulkruma.apiKeys.revoke(oldRecordId);
}
```

### Translate access keyId &rarr; record ID

`revoke` needs the record ID, but you usually have the access keyId (`AKIAFULK*`):

```ts
async function revokeByAccessKey(accessKeyId: string) {
  const { apiKeys } = await fulkruma.apiKeys.list();
  const found = apiKeys.find((k) => k.keyId === accessKeyId);
  if (!found) throw new Error(`No key found with keyId ${accessKeyId}`);
  await fulkruma.apiKeys.revoke(found.id);
}
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `VALIDATION` | 400 | Missing or oversized `name`, or a scope outside `read` / `write` / `admin`. |
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |
| `NOT_FOUND` | 404 | Record ID doesn't exist in this workspace (on revoke). |
| `ALREADY_REVOKED` | 409 | Revoking an already-revoked key. |

## Next

- [API: Authentication](/docs/api/authentication) &mdash; the HMAC signing recipe.
- [API: API keys](/docs/api/resources/api-keys) &mdash; HTTP reference.
- [Audit log](/docs/sdk/node/resources/audit-log) &mdash; every key-management action shows up here.
