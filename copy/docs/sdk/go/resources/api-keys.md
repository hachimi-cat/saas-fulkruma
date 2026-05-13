---
title: API keys
---

# API keys

An **API key** is the credential pair (`KeyID` + `Secret`) you sign Fulkruma requests with. Every workspace can have multiple keys with different descriptions and scopes &mdash; one for production, one for staging, one for a back-office script. Fulkruma keys carry the `AKIAFULK*` prefix; there's no test-mode/live-mode split (unlike Plugipay) because the merchant subscription model is single-environment. The Go SDK exposes three methods behind `client.APIKeys`. For the HTTP surface see [**API &rarr; API keys**](/docs/api/resources/api-keys), and for how keys are used in `NewClient` see [**API &rarr; Authentication**](/docs/api/authentication).

## Field on the Client

`client.APIKeys` &mdash; type `*fulkruma.APIKeysResource`. No `Update` &mdash; key metadata is immutable. To "rename" a key, revoke and re-create. **Using this namespace requires an admin-level key** (typically the bootstrap key the workspace was provisioned with).

## Methods

### List

**Signature.** `func (r *APIKeysResource) List(ctx context.Context) ([]map[string]any, error)`

Returns every key in the workspace, including revoked ones (filter on `revokedAt` to find active). The `secret` field is **never** returned on list.

```go
keys, err := client.APIKeys.List(ctx)
for _, k := range keys {
    state := "active"
    if v, ok := k["revokedAt"]; ok && v != nil {
        state = fmt.Sprintf("revoked %v", v)
    }
    fmt.Printf("%v — %v — %s\n", k["keyId"], k["description"], state)
}
```

### Create

**Signature.** `func (r *APIKeysResource) Create(ctx context.Context, in APIKeyCreateInput) (map[string]any, error)`

Mints a new key. Pass a human-readable `Description` (so you can identify it later in the dashboard) and optionally a `Scope` to narrow what it can do. The returned map includes the `secret` &mdash; **this is the only call that returns it**. The SDK auto-mints an `Idempotency-Key`.

```go
key, err := client.APIKeys.Create(ctx, fulkruma.APIKeyCreateInput{
    Description: "Production server (jakarta-1)",
    Scope:       "fulkruma:shipment:* fulkruma:stock:read",
})
if err != nil {
    return err
}
log.Println(key["keyId"])    // "AKIAFULK..."
log.Println(key["secret"])   // STORE NOW — never returned again
```

<blockquote class="callout-warn">

**The secret appears once.** Fulkruma shows the secret in the response to `Create` and never again. Stash it in your secret manager before the function returns. If you lose it, revoke the key and mint a new one.

</blockquote>

### Revoke

**Signature.** `func (r *APIKeysResource) Revoke(ctx context.Context, id string) (bool, error)`

Revokes a key. Subsequent requests signed with that key fail immediately with `invalid_signature` / `key_revoked`. There's no un-revoke; mint a fresh key.

```go
ok, err := client.APIKeys.Revoke(ctx, "apk_01HX...")
```

Note the argument is the `apk_*` record ID, **not** the `AKIAFULK*` keyId. They're different &mdash; the record ID is what the management API uses; the keyId is what you sign requests with.

## Types

```go
type APIKeyCreateInput struct {
    Description string `json:"description,omitempty"`
    Scope       string `json:"scope,omitempty"`
}
```

The returned `map[string]any` has these keys:

- `id` (string, `"apk_..."`) &mdash; used by `Revoke`
- `keyId` (string, `"AKIAFULK..."`) &mdash; the access key
- `description` (string or null)
- `scope` (string) &mdash; space-separated permission list
- `secret` (string) &mdash; **only on Create**
- `createdAt`, `revokedAt` (string or null)

For the full scope vocabulary, see [**API &rarr; API keys**](/docs/api/resources/api-keys) and [**API &rarr; Authentication**](/docs/api/authentication).

## Common patterns

### Mint a per-service key and stash it

```go
func mintServerKey(ctx context.Context, c *fulkruma.Client, serviceName string, secretManager Secrets) (string, error) {
    desc := fmt.Sprintf("Auto-provisioned: %s (%s)", serviceName, time.Now().UTC().Format("2006-01-02"))
    key, err := c.APIKeys.Create(ctx, fulkruma.APIKeyCreateInput{
        Description: desc,
        Scope:       "fulkruma:shipment:* fulkruma:stock:read fulkruma:webhook:read",
    })
    if err != nil {
        return "", err
    }
    keyID, _ := key["keyId"].(string)
    secret, _ := key["secret"].(string)
    if err := secretManager.Put(serviceName+"/FULKRUMA_KEY_ID", keyID); err != nil {
        return "", err
    }
    if err := secretManager.Put(serviceName+"/FULKRUMA_KEY_SECRET", secret); err != nil {
        return "", err
    }
    return keyID, nil
}
```

### Audit active keys

```go
func auditActive(ctx context.Context, c *fulkruma.Client) error {
    keys, err := c.APIKeys.List(ctx)
    if err != nil {
        return err
    }
    now := time.Now().UTC()
    for _, k := range keys {
        if k["revokedAt"] != nil {
            continue
        }
        if created, _ := k["createdAt"].(string); created != "" {
            if t, err := time.Parse(time.RFC3339, created); err == nil {
                age := int(now.Sub(t).Hours() / 24)
                fmt.Printf("%v — %v — %dd old\n", k["keyId"], k["description"], age)
            }
        }
    }
    return nil
}
```

### Rotate a key with overlap

Mint-then-revoke is safer than revoke-then-mint:

```go
func rotateKey(ctx context.Context, c *fulkruma.Client, oldRecordID, description string, deploy func(keyID, secret string) error) error {
    key, err := c.APIKeys.Create(ctx, fulkruma.APIKeyCreateInput{
        Description: fmt.Sprintf("%s (rotation %s)", description, time.Now().UTC().Format("2006-01-02")),
        Scope:       "*",
    })
    if err != nil {
        return err
    }
    if err := deploy(key["keyId"].(string), key["secret"].(string)); err != nil {
        return err
    }
    _, err = c.APIKeys.Revoke(ctx, oldRecordID)
    return err
}
```

### Translate access keyId &rarr; record ID

```go
func revokeByAccessKey(ctx context.Context, c *fulkruma.Client, accessKeyID string) error {
    keys, err := c.APIKeys.List(ctx)
    if err != nil {
        return err
    }
    for _, k := range keys {
        if k["keyId"] == accessKeyID {
            id, _ := k["id"].(string)
            _, err := c.APIKeys.Revoke(ctx, id)
            return err
        }
    }
    return fmt.Errorf("no key found with keyId %s", accessKeyID)
}
```

## Errors

| `Code` | `Status` | Cause |
|---|---|---|
| `validation_error` | 400 | Bad `Scope` value, description too long. |
| `insufficient_scope` | 403 | Calling key lacks `fulkruma:apikey:write`. |
| `not_found` | 404 | Record ID doesn't exist (on revoke). |
| `conflict` | 409 | Revoking an already-revoked key. |

## Next

- [**API &rarr; Authentication**](/docs/api/authentication) &mdash; the HMAC signing recipe.
- [**API &rarr; API keys**](/docs/api/resources/api-keys) &mdash; HTTP reference.
- [**Audit log**](/docs/sdk/go/resources/audit-log) &mdash; every key-management action shows up here.
