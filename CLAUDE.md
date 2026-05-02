# CLAUDE.md — Forjio Service Template

This repo is the **template**. When a Forjio product is forked from it,
copy this file into the forked repo and replace `FORJIO_BRAND` /
`forjio-brand` / `Forjio Brand` with the actual product identity.

## For Claude working inside a product repo forked from this template

### Product identity

- Brand: `FORJIO_BRAND` (e.g., "huudis")
- Domain: `brand.com` + `brand.forjio.com`
- Repo: `hachimi-cat/FORJIO_BRAND`
- CLI package: `@forjio/FORJIO_BRAND-cli`

### Non-negotiable

- **Use `@forjio/sdk`.** Never reinvent JWT verify, ARN parse, event
  envelope, API response envelope, policy eval. If it's in the SDK,
  import it.
- **Follow ADRs.** Load-bearing decisions live in
  [hachimi-cat/forjio-architecture/adr/](https://github.com/hachimi-cat/forjio-architecture/tree/master/adr).
  Read before inventing new patterns.
- **One DB per service.** This repo's DB belongs only to this product.
  No cross-service SQL. Cross-service data comes via REST or events.
- **Outbox for state changes.** See ADR-0006. Write to `outbox_events`
  inside the same transaction as the state change.
- **Idempotent consumers.** Every event handler guards on
  `processed_events(event_id)` unique.

### Repo shape

| Dir | Purpose |
|---|---|
| `backend/` | Express + Prisma. Auth via `@forjio/sdk/auth`. Health + outbox routes shipped; add product routes under `backend/src/routes/`. |
| `frontend/` | Next.js 15 App Router. Marketing site at `/`, dashboard at `/dashboard`, OIDC at `/callback`. Build both the website and the portal as one app. |
| `cli/` | Commander-based CLI. `auth login/whoami` ship; add product commands under `cli/src/commands/`. |
| `e2e/` | Playwright. Health smoke test ships; add per-flow tests per milestone. |

### Testing conventions

- Unit + integration in `backend/src/__tests__/` (Vitest).
- E2E in `e2e/tests/` (Playwright).
- CLI tests in `cli/src/__tests__/`.
- `npm test` at repo root runs all three.

### Conventions from Storlaunch worth keeping

- API envelope: `{ data, error, meta: { requestId, timestamp } }` (from
  `@forjio/sdk/http`).
- Prisma migrations named `YYYYMMDDHHMMSS_<snake_case>`.
- Semver bumps on CLI on every feature commit.
- Gojo log + memory update per session.

### DO NOT

- Copy Prisma models from Storlaunch without adapting to this service's
  bounded context.
- Add auth tables — they live in Huudis.
- Add a `Customer` model without thinking about whether it should be in
  Plugipay (payment customer) vs. Fulkruma (buyer address book) vs.
  Suppuo (support contact). Most likely: reference a Huudis identity +
  your own thin context-specific record.
