---
title: API keys
---

# API keys

An **API key** is the credential pair (`KeyID` + `Secret`) you sign Fulkruma requests with. Every workspace can have multiple keys, each with its own name &mdash; one for production, one for staging, one for a back-office script. Fulkruma keys carry the `AKIAFULK*` prefix; there's no test-mode/live-mode split (unlike Plugipay) because the merchant subscription model is single-environment. The Go SDK exposes three methods behind `client.APIKeys`. For the HTTP surface see [**API &rarr; API keys**](/docs/api/resources/api-keys), and for how keys are used in `NewClient` see [**API &rarr; Authentication**](/docs/api/authentication).

## Field on the Client

`client.APIKeys` &mdash; type `*fulkruma.APIKeysResource`. No `Update` &mdash; key metadata is immutable. To "rename" a key, revoke and re-create.

## Methods

### List

**Signature.** `func (r *APIKeysResource) List(ctx context.Context) ([]map[string]any, error)`

Returns every key in the workspace, newest first, including revoked ones (filter on `revokedAt` to find active). The `secret` is **never** returned on list &mdash; only a `secretPreview` for recognising a key by eye.

```go
keys, err := client.APIKeys.List(ctx)
for _, k := range keys {
    state := "active"
    if v, ok := k["revokedAt"]; ok && v != nil {
        state = fmt.Sprintf("revoked %v", v)
    }
    fmt.Printf("%v — %v — %s\n", k["keyId"], k["name"], state)
}
```

### Create

**Signature.** `func (r *APIKeysResource) Create(ctx context.Context, in APIKeyCreateInput) (*APIKeyCreated, error)`

Mints a new key. `Name` is required (1&ndash;120 characters) &mdash; make it specific so you can identify the key later in the dashboard. `Scopes` is any of `"read"`, `"write"`, `"admin"`; left empty, the server uses `["read", "write"]`. The result carries the key's record (`APIKey`) and the plaintext `Secret` &mdash; **this is the only call that returns it**. The SDK auto-mints an `Idempotency-Key`.

```go
created, err := client.APIKeys.Create(ctx, fulkruma.APIKeyCreateInput{
    Name:   "Production server (jakarta-1)",
    Scopes: []string{"read", "write"},
})
if err != nil {
    return err
}
log.Println(created.APIKey["keyId"]) // "AKIAFULK..."
log.Println(created.Secret)          // STORE NOW — never returned again
```

<blockquote class="callout-warn">

**The secret appears once.** Fulkruma shows the secret in the response to `Create` and never again. Stash it in your secret manager before the function returns. If you lose it, revoke the key and mint a new one.

</blockquote>

### Revoke

**Signature.** `func (r *APIKeysResource) Revoke(ctx context.Context, id string) (bool, error)`

Revokes a key; the request carries no body. The `bool` reports whether the server marked the key revoked (its `revokedAt` is set). Subsequent requests signed with that key fail immediately with `401 REVOKED_KEY`. There's no un-revoke; mint a fresh key.

```go
revoked, err := client.APIKeys.Revoke(ctx, "clx4q8k2b0001")
```

Note the argument is the record `id`, **not** the `AKIAFULK*` keyId. They're different &mdash; the record ID is what the management API uses; the keyId is what you sign requests with.

## Types

```go
type APIKeyCreateInput struct {
    Name   string   `json:"name"`
    Scopes []string `json:"scopes,omitempty"`
}

type APIKeyCreated struct {
    APIKey map[string]any `json:"apiKey"` // id, name, keyId, scopes, createdAt
    Secret string         `json:"secret"`
}
```

The maps returned by `List` have these keys:

- `id` (string) &mdash; the record ID, used by `Revoke`
- `name` (string)
- `keyId` (string, `"AKIAFULK..."`) &mdash; the access key
- `secretPreview` (string) &mdash; first 8 + last 4 of the secret
- `scopes` (array of `"read"` / `"write"` / `"admin"`)
- `createdAt`, `lastUsedAt`, `revokedAt` (string or null)
- `createdBy` (string or null)

`scopes` is recorded on the key and shown in the dashboard; the API does not yet check `read` / `write` / `admin` route by route, so treat any key as full access to its workspace. See [**API &rarr; API keys**](/docs/api/resources/api-keys#scopes).

## Common patterns

### Mint a per-service key and stash it

```go
func mintServerKey(ctx context.Context, c *fulkruma.Client, serviceName string, secretManager Secrets) (string, error) {
    created, err := c.APIKeys.Create(ctx, fulkruma.APIKeyCreateInput{
        Name: fmt.Sprintf("Auto-provisioned: %s (%s)", serviceName, time.Now().UTC().Format("2006-01-02")),
    })
    if err != nil {
        return "", err
    }
    keyID, _ := created.APIKey["keyId"].(string)
    if err := secretManager.Put(serviceName+"/FULKRUMA_KEY_ID", keyID); err != nil {
        return "", err
    }
    if err := secretManager.Put(serviceName+"/FULKRUMA_KEY_SECRET", created.Secret); err != nil {
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
                fmt.Printf("%v — %v — %dd old\n", k["keyId"], k["name"], age)
            }
        }
    }
    return nil
}
```

### Rotate a key with overlap

Mint-then-revoke is safer than revoke-then-mint:

```go
func rotateKey(ctx context.Context, c *fulkruma.Client, oldRecordID, name string, deploy func(keyID, secret string) error) error {
    created, err := c.APIKeys.Create(ctx, fulkruma.APIKeyCreateInput{
        Name: fmt.Sprintf("%s (rotation %s)", name, time.Now().UTC().Format("2006-01-02")),
    })
    if err != nil {
        return err
    }
    if err := deploy(created.APIKey["keyId"].(string), created.Secret); err != nil {
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
| `VALIDATION` | 400 | Missing or oversized `Name`, or a scope outside `read` / `write` / `admin`. |
| `NO_ACCOUNT` | 403 | The credentials resolve to no workspace. |
| `NOT_FOUND` | 404 | Record ID doesn't exist in this workspace (on revoke). |
| `ALREADY_REVOKED` | 409 | Revoking an already-revoked key. |

## Next

- [**API &rarr; Authentication**](/docs/api/authentication) &mdash; the HMAC signing recipe.
- [**API &rarr; API keys**](/docs/api/resources/api-keys) &mdash; HTTP reference.
- [**Audit log**](/docs/sdk/go/resources/audit-log) &mdash; every key-management action shows up here.
