---
title: API keys
---

# API keys

An **API key** is the credential pair (`keyId` + `secret`) you sign Fulkruma requests with. Every workspace can have multiple keys with different descriptions and scopes &mdash; one for production, one for staging, one for a back-office script. Fulkruma keys carry the `AKIAFULK*` prefix; there's no test-mode/live-mode split (unlike Plugipay) because the merchant subscription model is single-environment. This page covers the `fulkruma.apiKeys` namespace; for the underlying HTTP surface see [API: API keys](/docs/api/resources/api-keys), and for how keys are used in the SDK constructor see [API: Authentication](/docs/api/authentication).

## Namespace

`fulkruma.apiKeys` &mdash; every method:

```ts
fulkruma.apiKeys.list()
fulkruma.apiKeys.create(input)
fulkruma.apiKeys.revoke(id)
```

No `update` &mdash; key metadata is immutable. To "rename" a key, revoke and re-create. **Using this namespace requires an admin-level key** (typically the bootstrap key the workspace was provisioned with).

## Methods

### `apiKeys.list`

**Signature.** `fulkruma.apiKeys.list(): Promise<{ keys: Array<Record<string, unknown>> }>`

Returns every key in the workspace, including revoked ones (filter on `revokedAt` to find active). The `secret` field is **never** returned on list &mdash; it's only available on create.

```ts
const { keys } = await fulkruma.apiKeys.list();
for (const k of keys as Array<{ keyId: string; description?: string; revokedAt?: string }>) {
  const state = k.revokedAt ? `revoked ${k.revokedAt}` : 'active';
  console.log(`${k.keyId} — ${k.description ?? '(no description)'} — ${state}`);
}
```

### `apiKeys.create`

**Signature.** `fulkruma.apiKeys.create(input): Promise<{ key: Record<string, unknown> }>`

Mints a new key. Pass a human-readable `description` (so you can identify it later in the dashboard) and optionally a `scope` to narrow what it can do. The returned object includes the `secret` &mdash; **this is the only call that ever returns it**. The SDK auto-mints an `Idempotency-Key`.

```ts
const { key } = await fulkruma.apiKeys.create({
  description: 'Production server (jakarta-1)',
  scope: 'fulkruma:shipment:* fulkruma:stock:read',
});

const k = key as { keyId: string; secret: string };
console.log(k.keyId);    // → 'AKIAFULK...'
console.log(k.secret);   // STORE NOW — never returned again
```

<blockquote class="callout-warn">

**The secret appears once.** Fulkruma shows the secret in the response to `create` and never again. Stash it in your secret manager (AWS Secrets Manager, Vault, env file on a locked-down box, whatever you use) before the function returns. If you lose it, revoke the key and mint a new one.

</blockquote>

### `apiKeys.revoke`

**Signature.** `fulkruma.apiKeys.revoke(id): Promise<{ revoked: boolean }>`

Revokes a key. Subsequent requests signed with that key fail immediately with `invalid_signature` / `key_revoked`. There's no un-revoke; mint a fresh key if you need to restore access.

```ts
await fulkruma.apiKeys.revoke('apk_01HX...');
```

Note the argument is the `apk_*` record ID (returned on `list`/`create` as the `id` field), **not** the `AKIAFULK*` keyId. They're different &mdash; the record ID is what the management API uses; the keyId is what you sign requests with.

## Types

```ts
interface ApiKey {
  id: string;                  // 'apk_...' — used by .revoke()
  accountId: string;
  keyId: string;               // 'AKIAFULK...' — the access key
  description: string | null;
  scope: string;               // space-separated permission list
  /** Only returned on create. */
  secret?: string;
  createdAt: string;
  revokedAt: string | null;
}
```

For the full scope vocabulary (what permissions exist, which scopes group together), see [API: API keys](/docs/api/resources/api-keys) and [API: Authentication](/docs/api/authentication).

## Common patterns

### Mint a per-service key and stash it

Per-service keys are easier to revoke individually than one shared admin key:

```ts
async function mintServerKey(serviceName: string) {
  const { key } = await fulkruma.apiKeys.create({
    description: `Auto-provisioned: ${serviceName} (${new Date().toISOString().slice(0, 10)})`,
    scope: 'fulkruma:shipment:* fulkruma:stock:read fulkruma:webhook:read',
  });

  const k = key as { keyId: string; secret: string };
  await secretManager.put(`${serviceName}/FULKRUMA_KEY_ID`, k.keyId);
  await secretManager.put(`${serviceName}/FULKRUMA_KEY_SECRET`, k.secret);

  console.log(`Provisioned ${k.keyId} for ${serviceName}`);
  return k.keyId;
}
```

### Audit active keys

For periodic security reviews:

```ts
async function auditActiveKeys() {
  const { keys } = await fulkruma.apiKeys.list();
  const active = (keys as any[]).filter((k) => !k.revokedAt);
  console.log(`${active.length} active keys:`);
  for (const k of active) {
    const ageDays = Math.floor((Date.now() - Date.parse(k.createdAt)) / 86_400_000);
    console.log(`  ${k.keyId} — ${k.description ?? '(none)'} — ${ageDays}d old`);
  }
}
```

### Rotate a key with overlap

Mint-then-revoke is safer than revoke-then-mint &mdash; you have a window where both keys work, so you can deploy the new credentials before invalidating the old:

```ts
async function rotateKey(oldRecordId: string, description: string) {
  // 1. Mint the new one
  const { key } = await fulkruma.apiKeys.create({
    description: `${description} (rotation ${new Date().toISOString().slice(0, 10)})`,
    scope: '*',
  });

  // 2. Deploy the new credentials to your services. (Your CI's job.)
  const k = key as { keyId: string; secret: string };
  await deployNewKey(k.keyId, k.secret);

  // 3. After confirming the new key works everywhere, revoke the old one
  await fulkruma.apiKeys.revoke(oldRecordId);
}
```

### Translate access keyId &rarr; record ID

`revoke` needs the record ID (`apk_*`), but you usually have the access keyId (`AKIAFULK*`):

```ts
async function revokeByAccessKey(accessKeyId: string) {
  const { keys } = await fulkruma.apiKeys.list();
  const found = (keys as any[]).find((k) => k.keyId === accessKeyId);
  if (!found) throw new Error(`No key found with keyId ${accessKeyId}`);
  await fulkruma.apiKeys.revoke(found.id);
}
```

## Errors

| Code | Status | Cause |
|---|---|---|
| `validation_error` | 400 | Bad `scope` value, description too long. |
| `forbidden` | 403 | Calling key lacks `fulkruma:apikey:write` scope. |
| `not_found` | 404 | Record ID doesn't exist (on revoke). |
| `conflict` | 409 | Revoking an already-revoked key. |

## Next

- [API: Authentication](/docs/api/authentication) &mdash; the HMAC signing recipe.
- [API: API keys](/docs/api/resources/api-keys) &mdash; HTTP reference.
- [Audit log](/docs/sdk/node/resources/audit-log) &mdash; every key-management action shows up here.
