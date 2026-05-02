# CLAUDE.md — saas-fulkruma

Stock + warehouses + shipping. Extracted from Storlaunch (M5 of the
Forjio micro-SaaS roadmap). Plugs back into Storlaunch as a module via
the same Pattern 2 partner-billing model used by Plugipay.

## Product identity

- Brand: `fulkruma`
- Domain: `fulkruma.com` + `fulkruma.forjio.com`
- Repo: `hachimi-cat/saas-fulkruma`
- CLI package: `@forjio/fulkruma-cli`
- Backend port (dev): `4140`
- Frontend port (dev): `3140`

## Bounded context

Owns: `Warehouse`, `VariantStock`, `StockMovement`, `StockReservation`,
`Shipment`, `ShipmentEvent`, `CustomerAddress`, `Delivery`, `License`,
`LicenseActivation`. Plus shipping adapters (Biteship first).

Does NOT own: payments (→ Plugipay), product catalog (→ Storlaunch),
auth (→ Huudis), discounts/referrals (→ Ripllo).

## Non-negotiable

- **Use `@forjio/sdk`.** JWT verify, ARN parse, event envelope, API
  envelope, policy eval — never reinvent.
- **Follow ADRs** in `hachimi-cat/forjio-architecture/adr/`.
- **One DB per service.** No cross-service SQL.
- **Outbox for state changes** (ADR-0006). Write to `outbox_events`
  inside the same Prisma txn as the state change.
- **Idempotent consumers.** Guard on `processed_events(event_id)` unique.
- **Pattern 2 partner billing** with Plugipay — see
  `project_forjio_plugipay_storlaunch_integration.md`. Fulkruma is
  already in Plugipay's `KNOWN_PARTNERS`.

## Repo shape

| Dir | Purpose |
|---|---|
| `backend/` | Express + Prisma + Vitest. Health + outbox shipped; product routes under `backend/src/routes/` (warehouses, stock, shipments, addresses, deliveries, licenses). |
| `frontend/` | Next.js 15 App Router. Marketing at `/`, dashboard at `/dashboard`, OIDC at `/callback`. Light canvas + Twilio red `#F22F46` primary. |
| `cli/` | Commander-based CLI. `auth login/whoami` ship; add `warehouse`, `stock`, `shipment` command groups. |
| `e2e/` | Playwright. Health smoke test ships. |

## Visual

- **Light canvas** (off-white, similar to Huudis aesthetic but red instead of indigo)
- **Primary: `#F22F46`** (Twilio red)
- Inter / Roboto fonts; Lucide icons
- Reuse plugipay's `components/layout/{shell,sidebar,nav-config}.tsx` shape; recolor only

## Family role

- Hub identity: Huudis SSO (workspace `Fulkruma`, OIDC client seeded)
- Payment dependency: Plugipay (Pattern 2)
- Storefront integration: Storlaunch consumes Fulkruma as a module
- Indonesian framing **kept** (shipping/Biteship has regulatory tether)

## DO NOT

- Add auth tables — they live in Huudis
- Bill merchants directly when they come through Storlaunch — partner-roll via Pattern 2
- Reinvent the SDK pieces
